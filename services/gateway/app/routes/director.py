"""Director (beats, fallbacks, reset), είσοδος events από agent, live σύνοψη πόλης, health."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import httpx
from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import delete, func, select

from .. import db as tables
from ..context import AppContext, ContractError, now_iso, validate_event
from ..seed import seed_reports
from . import get_ctx, spawn
from .engage import public_consultation, public_url_for, save_consultation
from .scenarios import last_results

log = logging.getLogger("athena.director")
router = APIRouter(prefix="/api")

BEATS = ["INTRO", "PITCH", "SENSE", "SIMULATE", "ENGAGE", "DECISION", "CLOSE"]
_playback: dict[str, asyncio.Task[None] | None] = {"task": None}


def _beat(beat: str) -> str:
    b = beat.upper()
    if b not in BEATS:
        raise HTTPException(404, f"Άγνωστο beat: {beat}. Επιτρέπονται: {', '.join(BEATS)}")
    return b


def beat_cache_file(ctx: AppContext, beat: str) -> Path | None:
    for path in (
        ctx.demo_path("cache", "beats", f"{beat.lower()}.json"),
        ctx.settings.web_cache_dir / f"{beat.lower()}.json",
    ):
        if path.exists():
            return path
    return None


async def play_fallback(ctx: AppContext, beat: str, items: list[dict[str, Any]]) -> None:
    """Παίζει τα cached events ενός beat με τους αρχικούς χρόνους, μέσω του hub (άρα με replay)."""
    started = time.monotonic()
    for item in items:
        ev = item.get("event") or item.get("ev") or {}
        etype, payload = ev.get("type"), ev.get("payload")
        delay = item.get("atMs", 0) / 1000 - (time.monotonic() - started)
        if delay > 0:
            await asyncio.sleep(delay)
        if etype == "vote.tally" and not ctx.settings.mock:
            continue  # οι ψήφοι είναι πάντα live
        try:
            if etype == "consultation.opened":
                # Η διαβούλευση του fallback γίνεται πραγματική: το QR δείχνει στο δικό μας citizen app.
                payload = {**payload, "publicUrl": public_url_for(ctx, payload["id"])}
                validate_event(etype, payload)
                await save_consultation(ctx, payload)
                payload = public_consultation(ctx, payload, public=False)
            validate_event(etype, payload)
            ctx.publish(etype, payload)
        except (ContractError, KeyError, TypeError) as exc:
            log.warning("fallback %s: παράλειψη event %s (%s)", beat, etype, exc)
    log.info("fallback %s: τέλος (%d events)", beat, len(items))


def start_fallback(ctx: AppContext, beat: str) -> int:
    path = beat_cache_file(ctx, beat)
    if path is None:
        raise HTTPException(404, f"Δεν υπάρχει cached fallback για {beat}")
    items = json.loads(path.read_text(encoding="utf-8"))
    if (task := _playback["task"]) and not task.done():
        task.cancel()
    _playback["task"] = spawn(play_fallback(ctx, beat, items))
    return len(items)


# Σειρά: τα στατικά paths πριν από το /director/{beat}
@router.post("/director/reset")
async def reset(ctx: AppContext = Depends(get_ctx)) -> dict[str, Any]:
    """Καθαρίζει για νέα πρόβα. Κρατά τις ιστορικές (seeded) αναφορές και το cache του sim."""
    if (task := _playback["task"]) and not task.done():
        task.cancel()
    async with ctx.db.engine.begin() as conn:
        n_reports = (await conn.execute(delete(tables.reports).where(tables.reports.c.seeded.is_(False)))).rowcount
        n_votes = (await conn.execute(delete(tables.votes))).rowcount
        await conn.execute(delete(tables.consultations))
        await conn.execute(delete(tables.scenarios))
    ctx.hub.clear()
    ctx.tallies.reset()
    last_results.clear()
    ctx.status.fallbacks.clear()
    ctx.publish("state.reset", {})
    ctx.status.broadcast()
    return {"ok": True, "removedReports": n_reports, "removedVotes": n_votes}


@router.post("/director/seed")
async def seed(force: bool = False, ctx: AppContext = Depends(get_ctx)) -> dict[str, Any]:
    return {"ok": True, "seeded": await seed_reports(ctx, force=force)}


@router.get("/director/status")
async def director_status(ctx: AppContext = Depends(get_ctx)) -> dict[str, Any]:
    return ctx.status.snapshot()


@router.post("/director/fallback/{beat}")
async def fallback(beat: str, ctx: AppContext = Depends(get_ctx)) -> dict[str, Any]:
    b = _beat(beat)
    n = start_fallback(ctx, b)
    ctx.status.fallback(f"Director: fallback για {b}")
    return {"ok": True, "beat": b, "events": n}


@router.post("/director/{beat}")
async def director_beat(beat: str, auto_fallback: bool = True, ctx: AppContext = Depends(get_ctx)) -> dict[str, Any]:
    b = _beat(beat)
    ctx.publish("director.beat", {"beat": b})
    if ctx.settings.mock:
        if beat_cache_file(ctx, b):
            start_fallback(ctx, b)
        return {"ok": True, "beat": b, "agent": "mock"}
    spawn(_forward_beat(ctx, b, auto_fallback))
    return {"ok": True, "beat": b, "agent": "forwarded"}


async def _forward_beat(ctx: AppContext, beat: str, auto_fallback: bool) -> None:
    try:
        r = await ctx.http.post(f"{ctx.settings.agent_url}/director/{beat}", timeout=4.0)
        ctx.status.set_service("agent", "up")
        if r.status_code >= 400:
            ctx.status.fallback(f"Ο agent απάντησε {r.status_code} στο beat {beat}")
    except httpx.ConnectError:
        ctx.status.set_service("agent", "down")
        if auto_fallback and beat_cache_file(ctx, beat):
            start_fallback(ctx, beat)
            ctx.status.fallback(f"Agent εκτός → αυτόματο fallback για {beat}")
        else:
            ctx.status.fallback(f"Agent εκτός στο beat {beat}")
    except httpx.HTTPError as exc:
        ctx.status.fallback(f"Beat {beat}: ο agent δεν απάντησε ({exc.__class__.__name__})")


# ---------- events από agent / director ----------
@router.post("/events")
async def post_events(
    body: dict[str, Any] | list[dict[str, Any]] = Body(...), ctx: AppContext = Depends(get_ctx)
) -> dict[str, Any]:
    """Ο agent «οδηγεί» την οθόνη: { type, payload } ή λίστα από αυτά. Ελέγχονται με τα contracts."""
    items = body if isinstance(body, list) else [body]
    for ev in items:
        if not isinstance(ev, dict) or "type" not in ev or "payload" not in ev:
            raise HTTPException(422, "Αναμένεται { type, payload }")
    try:
        for ev in items:
            validate_event(ev["type"], ev["payload"])
    except ContractError as exc:
        raise HTTPException(422, str(exc)) from exc
    for ev in items:
        await ctx.ingest(ev["type"], ev["payload"])
    return {"ok": True, "count": len(items)}


@router.post("/agent/prompt", status_code=202)
async def agent_prompt(body: dict[str, Any], ctx: AppContext = Depends(get_ctx)) -> dict[str, Any]:
    text = str(body.get("textEl", "")).strip()
    if not text:
        raise HTTPException(422, "Κενό textEl")
    if ctx.settings.mock:
        ctx.publish("agent.thinking", {"stepEl": f"Άκουσα: «{text}»"})
        ctx.publish("agent.say", {"textEl": "(mock) Το κατάλαβα. Τρέχω το σενάριο.", "mood": "neutral"})
        return {"ok": True, "agent": "mock"}

    async def forward() -> None:
        try:
            r = await ctx.http.post(
                f"{ctx.settings.agent_url}/prompt", json={"textEl": text}, timeout=ctx.settings.agent_timeout_s
            )
            ctx.status.set_service("agent", "up")
            r.raise_for_status()
        except httpx.ConnectError:
            ctx.status.set_service("agent", "down")
            ctx.status.fallback("Ο agent δεν πήρε την εντολή του director")
        except httpx.HTTPError as exc:
            ctx.status.fallback(f"Agent prompt: {exc.__class__.__name__}")

    spawn(forward())
    return {"ok": True, "agent": "forwarded"}


# ---------- σύνοψη πόλης / health ----------
@router.get("/city/live")
async def city_live(ctx: AppContext = Depends(get_ctx)) -> dict[str, Any]:
    since = (datetime.now(UTC) - timedelta(hours=24)).strftime("%Y-%m-%dT%H:%M:%S")
    async with ctx.db.engine.connect() as conn:
        visible = tables.reports.c.hidden.is_(False)
        total = (await conn.execute(select(func.count()).select_from(tables.reports).where(visible))).scalar_one()
        last24h = (
            await conn.execute(
                select(func.count()).select_from(tables.reports).where(visible, tables.reports.c.created_at >= since)
            )
        ).scalar_one()
        by_cat: dict[str, int] = {}
        for (cls,) in await conn.execute(select(tables.reports.c.classification).where(visible)):
            if cls and cls.get("category"):
                by_cat[cls["category"]] = by_cat.get(cls["category"], 0) + 1
    return {
        "updatedAt": now_iso(),
        "buses": ctx.oasa.summary() if ctx.oasa else {"active": 0, "lines": [], "source": "down"},
        "weather": await ctx.weather.get(),
        "reports": {"total": total, "last24h": last24h, "byCategory": dict(sorted(by_cat.items()))},
    }


@router.get("/health")
async def health(ctx: AppContext = Depends(get_ctx)) -> dict[str, Any]:
    return {
        "ok": True,
        "mock": ctx.settings.mock,
        "db": ctx.db.kind,
        "postgis": ctx.db.postgis,
        "services": ctx.status.snapshot()["services"],
        "clients": ctx.hub.rooms(),
        "publicCitizenUrl": ctx.settings.public_citizen_url,
        "uptimeS": round((datetime.now(UTC) - ctx.started_at).total_seconds()),
        "fallbacks": list(ctx.status.fallbacks),
    }
