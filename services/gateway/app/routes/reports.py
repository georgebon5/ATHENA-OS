from __future__ import annotations

import asyncio
import base64
import logging
import uuid
from typing import Any

import httpx
from athena_contracts import ReportClassification
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from sqlalchemy import select

from .. import db as tables
from .. import media
from ..context import AppContext, now_iso
from ..security import RateLimiter, device_id, is_proxied, set_device_cookie
from . import get_ctx, spawn

log = logging.getLogger("athena.reports")
router = APIRouter(prefix="/api")

MAX_UPLOAD_BYTES = 15 * 1024 * 1024
report_limiter = RateLimiter(min_interval_s=4.0)


def report_out(ctx: AppContext, row: Any, public: bool = False) -> dict[str, Any]:
    url = row.photo_url
    out: dict[str, Any] = {
        "id": row.id,
        "createdAt": row.created_at,
        "photoUrl": url if public and url.startswith("/") else ctx.abs_url(url),
        "location": [row.lng, row.lat],
        "heading": row.heading,
        "accuracyM": row.accuracy_m,
    }
    if row.classification:
        out["classification"] = row.classification
    return out


async def visible_reports(ctx: AppContext) -> list[dict[str, Any]]:
    async with ctx.db.engine.connect() as conn:
        rows = await conn.execute(
            select(tables.reports).where(tables.reports.c.hidden.is_(False)).order_by(tables.reports.c.created_at)
        )
        return [report_out(ctx, r) for r in rows]


def _opt_float(v: str | None, lo: float, hi: float) -> float | None:
    if v is None or v.strip().lower() in {"", "null", "undefined", "nan"}:
        return None
    try:
        f = float(v)
    except ValueError:
        return None
    return f if lo <= f <= hi else None


@router.post("/reports", status_code=201)
async def create_report(
    request: Request,
    photo: UploadFile = File(...),
    lng: float = Form(...),
    lat: float = Form(...),
    heading: str | None = Form(None),
    accuracy: str | None = Form(None),
    ctx: AppContext = Depends(get_ctx),
) -> JSONResponse:
    if not (-180 <= lng <= 180 and -90 <= lat <= 90):
        raise HTTPException(422, "Μη έγκυρες συντεταγμένες")
    did, new_device = device_id(request)
    if not report_limiter.allow(did):
        raise HTTPException(429, "Περίμενε λίγα δευτερόλεπτα πριν την επόμενη αναφορά")
    data = await photo.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Η φωτογραφία είναι πολύ μεγάλη (μέγιστο 15 MB)")
    try:
        jpeg = await asyncio.to_thread(media.process_photo, data)
    except media.BadImage as exc:
        raise HTTPException(415, "Το αρχείο δεν είναι εικόνα") from exc

    rid = str(uuid.uuid4())
    photo_path = media.save(ctx.settings.media_dir, "photos", f"{rid}.jpg", jpeg)
    row = {
        "id": rid,
        "created_at": now_iso(),
        "photo_url": photo_path,
        "lng": round(lng, 7),
        "lat": round(lat, 7),
        "heading": _opt_float(heading, 0, 360),
        "accuracy_m": _opt_float(accuracy, 0, 100_000),
        "classification": None,
        "hidden": False,
        "seeded": False,
        "device_id": did,
    }
    async with ctx.db.engine.begin() as conn:
        await conn.execute(tables.reports.insert().values(**row))
    report = report_out(ctx, _Row(row))
    ctx.publish("report.created", report)
    spawn(classify(ctx, report, jpeg))

    resp = JSONResponse(report_out(ctx, _Row(row), public=is_proxied(request.scope)), status_code=201)
    if new_device:
        set_device_cookie(request, resp, did)
    return resp


class _Row:
    def __init__(self, d: dict[str, Any]):
        self.__dict__.update(d)


@router.get("/reports")
async def list_reports(ctx: AppContext = Depends(get_ctx)) -> list[dict[str, Any]]:
    return await visible_reports(ctx)


@router.get("/reports/{report_id}")
async def get_report(report_id: str, request: Request, ctx: AppContext = Depends(get_ctx)) -> dict[str, Any]:
    async with ctx.db.engine.connect() as conn:
        row = (await conn.execute(select(tables.reports).where(tables.reports.c.id == report_id))).first()
    if row is None or row.hidden:
        raise HTTPException(404, "Δεν βρέθηκε")
    return report_out(ctx, row, public=is_proxied(request.scope))


@router.post("/reports/{report_id}/hide")
async def hide_report(report_id: str, ctx: AppContext = Depends(get_ctx)) -> dict[str, Any]:
    """Moderation: ο director κρύβει ακατάλληλη φωτογραφία με ένα κλικ."""
    await ctx.ingest("report.hidden", {"id": report_id})
    return {"ok": True, "id": report_id}


async def classify(ctx: AppContext, report: dict[str, Any], jpeg: bytes) -> None:
    """report.created → agent /classify → report.classified. Ποτέ δεν ρίχνει τον gateway."""
    lng, lat = report["location"]
    try:
        nearby = await ctx.db.nearby_reports(report["id"], lng, lat)
    except Exception:  # noqa: BLE001
        log.exception("nearby query failed")
        nearby = []

    if ctx.settings.mock:
        await asyncio.sleep(1.2)
        cls = ctx.fixture("classification.json")
        cls["duplicates"] = [n["id"] for n in nearby if n["distanceM"] <= 25][:3]
    else:
        body = {
            "reportId": report["id"],  # ό,τι χρειάζεται ο agent· τα υπόλοιπα τον γλιτώνουν από fetch
            "report": report,
            "imageBase64": base64.b64encode(jpeg).decode(),
            "mimeType": "image/jpeg",
            "nearby": nearby,
        }
        try:
            r = await ctx.http.post(
                f"{ctx.settings.agent_url}/classify", json=body, timeout=ctx.settings.agent_timeout_s
            )
            ctx.status.set_service("agent", "up")
            if r.status_code in (202, 204):
                return  # ο agent θα στείλει μόνος του report.classified στο /api/events
            r.raise_for_status()
            data = r.json()
            cls = data.get("classification", data) if isinstance(data, dict) else data
            ReportClassification.model_validate(cls)
        except httpx.ConnectError:
            ctx.status.set_service("agent", "down")
            ctx.status.fallback("Ταξινόμηση: ο agent δεν είναι διαθέσιμος")
            return
        except (httpx.HTTPError, ValueError, ValidationError) as exc:
            ctx.status.fallback(f"Ταξινόμηση απέτυχε ({exc.__class__.__name__})")
            return
    try:
        await ctx.ingest("report.classified", {**report, "classification": cls})
    except Exception:  # noqa: BLE001
        log.exception("report.classified failed")
