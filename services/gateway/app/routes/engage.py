from __future__ import annotations

import json
import math
import uuid
from functools import lru_cache
from pathlib import Path
from typing import Any

from athena_contracts import ConsultationCreate, Vote
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from sqlalchemy import select

from .. import db as tables
from .. import media
from ..context import AppContext, now_iso
from ..security import RateLimiter, device_id, is_proxied, set_device_cookie
from . import get_ctx

router = APIRouter(prefix="/api")
vote_limiter = RateLimiter(min_interval_s=0.8)
MAX_MEDIA_BYTES = 20 * 1024 * 1024
# Χοντρικά η Αττική: ό,τι είναι έξω το αγνοούμε (η θέση είναι προαιρετική)
ATTICA = (23.3, 37.6, 24.2, 38.4)
SERAFIO = (23.7108, 37.9787)
CATEGORY_EL = {
    "pothole": "Λακκούβα",
    "sidewalk_damage": "Φθορά πεζοδρομίου",
    "waste": "Απορρίμματα",
    "lighting": "Φωτισμός",
    "obstruction": "Εμπόδιο",
    "heat_exposure": "Θερμική έκθεση",
    "graffiti": "Graffiti",
    "accessibility": "Προσβασιμότητα",
}


@lru_cache(maxsize=2)
def load_projects(path: Path) -> dict[str, dict[str, Any]]:
    try:
        features = json.loads(path.read_text(encoding="utf-8")).get("features", [])
    except (OSError, ValueError):
        return {}
    return {
        f["properties"]["id"]: {"title": f["properties"]["title"], "lngLat": tuple(f["geometry"]["coordinates"][:2])}
        for f in features
        if f.get("geometry", {}).get("type") == "Point"
    }


def report_title(row: Any) -> str:
    return CATEGORY_EL.get((row.classification or {}).get("category"), "Αναφορά πολίτη")


def distance_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    dx = (b[0] - a[0]) * 111_320 * math.cos(math.radians(a[1]))
    return math.hypot(dx, (b[1] - a[1]) * 111_320)


async def virtual_consultation(ctx: AppContext, cid: str) -> dict[str, Any] | None:
    """Αναφορές (r-<id>) και δημοτικά έργα (p-<id>) ψηφίζονται σαν διαβουλεύσεις: ίδια ψήφος, tally, οθόνη ψήφου."""
    kind, _, key = cid.partition("-")
    base = {"id": cid, "scenarioId": "", "publicUrl": public_url_for(ctx, cid)}
    if kind == "r":
        async with ctx.db.engine.connect() as conn:
            row = (
                await conn.execute(
                    select(tables.reports).where(tables.reports.c.id == key, tables.reports.c.hidden.is_(False))
                )
            ).first()
        if row is None:
            return None
        question = f"{report_title(row)}: να το φτιάξει ο Δήμος με προτεραιότητα;"
        return base | {"reportId": key, "beforeUrl": row.photo_url, "afterUrl": row.photo_url, "questionEl": question}
    if kind == "p" and (p := load_projects(ctx.settings.projects_file).get(key)):
        return base | {"beforeUrl": "", "afterUrl": "", "questionEl": f"Συμφωνείς με το έργο «{p['title']}»;"}
    return None


def public_consultation(ctx: AppContext, c: dict[str, Any], public: bool) -> dict[str, Any]:
    if not public:
        return {**c, "beforeUrl": ctx.abs_url(c["beforeUrl"]), "afterUrl": ctx.abs_url(c["afterUrl"])}
    return {**c, "beforeUrl": ctx.public_url(c["beforeUrl"]), "afterUrl": ctx.public_url(c["afterUrl"])}


async def load_consultation(ctx: AppContext, cid: str) -> dict[str, Any]:
    async with ctx.db.engine.connect() as conn:
        row = (await conn.execute(select(tables.consultations).where(tables.consultations.c.id == cid))).first()
    if row is not None:
        return row.data
    if virtual := await virtual_consultation(ctx, cid):
        return virtual
    raise HTTPException(404, "Η διαβούλευση δεν βρέθηκε")


async def save_consultation(ctx: AppContext, c: dict[str, Any]) -> None:
    async with ctx.db.engine.begin() as conn:
        exists = (
            await conn.execute(select(tables.consultations.c.id).where(tables.consultations.c.id == c["id"]))
        ).first()
        if exists:
            await conn.execute(tables.consultations.update().where(tables.consultations.c.id == c["id"]).values(data=c))
        else:
            await conn.execute(tables.consultations.insert().values(id=c["id"], data=c, created_at=now_iso()))


def public_url_for(ctx: AppContext, cid: str) -> str:
    return f"{ctx.settings.public_citizen_url}/v/{cid}"


@router.post("/consultations", status_code=201)
async def create_consultation(body: dict[str, Any], ctx: AppContext = Depends(get_ctx)) -> dict[str, Any]:
    try:
        ConsultationCreate.model_validate(body)
    except ValidationError as exc:
        raise HTTPException(422, exc.errors(include_url=False)) from exc
    cid = f"c-{uuid.uuid4().hex[:8]}"
    c = {
        "id": cid,
        "scenarioId": body["scenarioId"],
        "beforeUrl": body["beforeUrl"],
        "afterUrl": body["afterUrl"],
        "questionEl": body["questionEl"],
        "publicUrl": public_url_for(ctx, cid),
    }
    if body.get("reportId"):
        c["reportId"] = body["reportId"]
    await save_consultation(ctx, c)
    out = public_consultation(ctx, c, public=False)
    ctx.publish("consultation.opened", out)
    ctx.publish("vote.tally", await ctx.tallies.tally(cid))
    return out


@router.get("/consultations/{cid}")
async def get_consultation(cid: str, request: Request, ctx: AppContext = Depends(get_ctx)) -> JSONResponse:
    c = await load_consultation(ctx, cid)
    did, new_device = device_id(request)
    resp = JSONResponse(public_consultation(ctx, c, is_proxied(request.scope)))
    if new_device:
        set_device_cookie(request, resp, did)
    return resp


@router.get("/consultations/{cid}/tally")
async def get_tally(cid: str, ctx: AppContext = Depends(get_ctx)) -> dict[str, Any]:
    await load_consultation(ctx, cid)
    return await ctx.tallies.tally(cid)


@router.post("/consultations/{cid}/votes")
async def cast_vote(
    cid: str, body: dict[str, Any], request: Request, ctx: AppContext = Depends(get_ctx)
) -> JSONResponse:
    body = {**body, "consultationId": cid}
    try:
        vote = Vote.model_validate(body)
    except ValidationError as exc:
        raise HTTPException(422, "Μη έγκυρη ψήφος") from exc
    if cid not in ctx.tallies.known:
        await load_consultation(ctx, cid)
        ctx.tallies.known.add(cid)
    did, new_device = device_id(request)
    if not vote_limiter.allow(f"{cid}:{did}"):
        raise HTTPException(429, "Μία ψήφος τη φορά")
    loc = vote.location.root if vote.location else None
    if loc and not (ATTICA[0] <= loc[0] <= ATTICA[2] and ATTICA[1] <= loc[1] <= ATTICA[3]):
        loc = None
    await ctx.tallies.cast(cid, did, vote.choice.root, loc, vote.comment, now_iso())
    resp = JSONResponse(await ctx.tallies.tally(cid))
    if new_device:
        set_device_cookie(request, resp, did)
    return resp


@router.get("/votables")
async def votables(
    lng: float, lat: float, radiusM: float = 1500, limit: int = 12, ctx: AppContext = Depends(get_ctx)
) -> list[dict[str, Any]]:
    """Ό,τι ψηφίζεται κοντά μου: ανοιχτές διαβουλεύσεις, αναφορές πολιτών, δημοτικά έργα (κοντινότερα πρώτα)."""
    async with ctx.db.engine.connect() as conn:
        reports = (await conn.execute(select(tables.reports).where(tables.reports.c.hidden.is_(False)))).all()
        consultations = (await conn.execute(select(tables.consultations))).all()
    report_at = {r.id: (r.lng, r.lat) for r in reports}
    # ponytail: διαβούλευση χωρίς αναφορά → στο Σεράφειο (όλα τα σενάρια του demo είναι στην Πειραιώς)
    items = [
        ("consultation", row.data["id"], row.data["questionEl"], report_at.get(row.data.get("reportId"), SERAFIO))
        for row in consultations
    ]
    items += [("report", f"r-{r.id}", report_title(r), (r.lng, r.lat)) for r in reports]
    items += [
        ("project", f"p-{pid}", p["title"], p["lngLat"]) for pid, p in load_projects(ctx.settings.projects_file).items()
    ]
    near = sorted((distance_m((lng, lat), at), kind, cid, title, at) for kind, cid, title, at in items)
    out = []
    for d, kind, cid, title, at in near[:limit]:
        if d > radiusM:
            break
        t = await ctx.tallies.tally(cid)
        out.append(
            {
                "id": cid,
                "kind": kind,
                "titleEl": title,
                "lngLat": list(at),
                "distanceM": round(d),
                "publicUrl": public_url_for(ctx, cid),
                "yes": t["yes"],
                "no": t["no"],
                "maybe": t["maybe"],
            }
        )
    return out


@router.post("/media", status_code=201)
async def upload_media(file: UploadFile = File(...), ctx: AppContext = Depends(get_ctx)) -> dict[str, str]:
    """Για τον agent: εικόνες after (image edit) και audio του TTS. Επιστρέφει MediaUploadResult."""
    ext = media.ALLOWED_UPLOADS.get((file.content_type or "").split(";")[0].strip())
    if not ext:
        raise HTTPException(415, f"Μη υποστηριζόμενος τύπος: {file.content_type}")
    data = await file.read(MAX_MEDIA_BYTES + 1)
    if len(data) > MAX_MEDIA_BYTES:
        raise HTTPException(413, "Πολύ μεγάλο αρχείο")
    sub = "audio" if ext in {".mp3", ".wav", ".ogg", ".webm"} else "images"
    path = media.save(ctx.settings.media_dir, sub, f"{uuid.uuid4().hex}{ext}", data)
    return {"url": ctx.abs_url(path)}
