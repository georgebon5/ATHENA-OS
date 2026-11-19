from __future__ import annotations

import uuid
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


def public_consultation(ctx: AppContext, c: dict[str, Any], public: bool) -> dict[str, Any]:
    if not public:
        return {**c, "beforeUrl": ctx.abs_url(c["beforeUrl"]), "afterUrl": ctx.abs_url(c["afterUrl"])}
    return {**c, "beforeUrl": ctx.public_url(c["beforeUrl"]), "afterUrl": ctx.public_url(c["afterUrl"])}


async def load_consultation(ctx: AppContext, cid: str) -> dict[str, Any]:
    async with ctx.db.engine.connect() as conn:
        row = (await conn.execute(select(tables.consultations).where(tables.consultations.c.id == cid))).first()
    if row is None:
        raise HTTPException(404, "Η διαβούλευση δεν βρέθηκε")
    return row.data


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
