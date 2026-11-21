"""Σενάρια → sim → sim.result. Live πρώτα· αν ο sim αργεί >8 s ή πέσει, cached αποτέλεσμα."""

from __future__ import annotations

import asyncio
import contextlib
import hashlib
import json
import logging
import math
import time
import uuid
from typing import Any

import httpx
from athena_contracts import Backtest, Scenario, SimResult
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import TypeAdapter, ValidationError
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from .. import db as tables
from ..context import AppContext, now_iso
from . import get_ctx

log = logging.getLogger("athena.scenarios")
router = APIRouter(prefix="/api")

# Τελευταίο αποτέλεσμα ανά scenario id, από οποιαδήποτε πηγή (live/cache/fallback/mock)
last_results: dict[str, dict[str, Any]] = {}
# Μπαίνει στο κλειδί του cache: όταν αλλάζει το μοντέλο του sim, τα παλιά αποτελέσματα αγνοούνται.
SIM_CACHE_VERSION = 2


def scenario_hash(scenario: dict[str, Any]) -> str:
    key = json.dumps(
        {"v": SIM_CACHE_VERSION, "edits": scenario["edits"], "when": scenario["when"]},
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(key.encode()).hexdigest()[:24]


def _zero() -> dict[str, float]:
    return {"p10": 0.0, "p50": 0.0, "p90": 0.0}


def error_result(scenario: dict[str, Any], elapsed_ms: float, reason_el: str) -> dict[str, Any]:
    return {
        "scenarioId": scenario["id"],
        "status": "error",
        "computeMs": round(elapsed_ms),
        "traffic": {"segments": [], "corridorTravelTimeDeltaPct": _zero(), "vehicleKmDeltaPct": _zero(), "trips": []},
        "thermal": {"when": scenario["when"], "cells": [], "hotspotDeltaC": _zero()},
        "emissions": {"co2DeltaPct": _zero()},
        "notes": [reason_el],
    }


def _upsert(ctx: AppContext, table, values: dict[str, Any], key: str):  # type: ignore[no-untyped-def]
    insert = pg_insert if ctx.db.kind == "postgres" else sqlite_insert
    stmt = insert(table).values(**values)
    return stmt.on_conflict_do_update(index_elements=[key], set_={k: stmt.excluded[k] for k in values if k != key})


async def _cached(ctx: AppContext, scenario: dict[str, Any], h: str) -> dict[str, Any] | None:
    async with ctx.db.engine.connect() as conn:
        row = (await conn.execute(select(tables.sim_results).where(tables.sim_results.c.hash == h))).first()
    if row:
        return row.result
    for name in (f"{h}.json", f"{scenario['id']}.json"):
        path = ctx.demo_path("cache", "sim", name)
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
    return None


async def _store(ctx: AppContext, h: str, result: dict[str, Any]) -> None:
    async with ctx.db.engine.begin() as conn:
        await conn.execute(
            _upsert(ctx, tables.sim_results, {"hash": h, "result": result, "created_at": now_iso()}, "hash")
        )
    path = ctx.demo_path("cache", "sim", f"{h}.json")
    with contextlib.suppress(OSError):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")


async def obtain_result(ctx: AppContext, scenario: dict[str, Any], h: str) -> tuple[dict[str, Any], str]:
    started = time.monotonic()
    if ctx.settings.mock:
        await asyncio.sleep(1.5)
        name = "sim_result_variant.json" if scenario["origin"] == "agent_variant" else "sim_result.json"
        return ctx.fixture(name), "mock"

    reason = ""
    # Αν ο monitor ξέρει ήδη ότι ο sim είναι κάτω, μην περιμένεις 8 s για να το ξαναμάθεις.
    timeout = 2.0 if ctx.status.services.get("sim") == "down" else ctx.settings.sim_timeout_s
    try:
        # asyncio.timeout: φράζει και το DNS lookup, που το httpx timeout δεν το κόβει
        async with asyncio.timeout(timeout + 0.2):
            r = await ctx.http.post(f"{ctx.settings.sim_url}/simulate", json=scenario, timeout=timeout)
        ctx.status.set_service("sim", "up")
        r.raise_for_status()
        result = r.json()
        SimResult.model_validate(result)
        if result["status"] == "ok":
            await _store(ctx, h, result)
            return result, "live"
        reason = "ο sim επέστρεψε error"
    except (httpx.TimeoutException, TimeoutError):
        reason = f"ο sim άργησε >{timeout:.0f}s"
    except httpx.ConnectError:
        ctx.status.set_service("sim", "down")
        reason = "ο sim δεν είναι διαθέσιμος"
    except (httpx.HTTPError, ValueError, ValidationError) as exc:
        reason = f"μη έγκυρη απάντηση sim ({exc.__class__.__name__})"

    cached = await _cached(ctx, scenario, h)
    if cached:
        ctx.status.fallback(f"Σενάριο «{scenario['title']}»: {reason} → cached αποτέλεσμα")
        return cached, "fallback"
    ctx.status.fallback(f"Σενάριο «{scenario['title']}»: {reason}, χωρίς cache")
    return error_result(
        scenario, (time.monotonic() - started) * 1000, f"Η προσομοίωση δεν ολοκληρώθηκε: {reason}"
    ), "error"


async def run_scenario(ctx: AppContext, scenario: dict[str, Any], broadcast: bool = True) -> tuple[dict[str, Any], str]:
    h = scenario_hash(scenario)
    async with ctx.db.engine.begin() as conn:
        await conn.execute(
            _upsert(
                ctx,
                tables.scenarios,
                {"id": scenario["id"], "hash": h, "data": scenario, "created_at": now_iso()},
                "id",
            )
        )
    progress: asyncio.Task[None] | None = None
    if broadcast:
        ctx.publish("scenario.created", scenario)
        ctx.publish("sim.progress", {"scenarioId": scenario["id"], "pct": 0.0})
        progress = asyncio.create_task(_progress(ctx, scenario["id"]))
    try:
        result, source = await obtain_result(ctx, scenario, h)
    finally:
        if progress:
            progress.cancel()
    result = {**result, "scenarioId": scenario["id"]}
    last_results[scenario["id"]] = result
    if broadcast and result["status"] == "ok":
        ctx.publish("sim.progress", {"scenarioId": scenario["id"], "pct": 1.0})
        ctx.publish("sim.result", result)
    log.info("scenario %s → %s (%s)", scenario["id"], result["status"], source)
    return result, source


async def _progress(ctx: AppContext, scenario_id: str) -> None:
    """Ο sim δεν στέλνει πρόοδο· δείχνουμε χρόνο αναμονής (ασυμπτωτικά ως 90%), όχι αποτέλεσμα."""
    started = time.monotonic()
    while True:
        await asyncio.sleep(0.4)
        pct = 0.9 * (1 - math.exp(-(time.monotonic() - started) / 2.5))
        ctx.publish("sim.progress", {"scenarioId": scenario_id, "pct": round(pct, 3)})


@router.post("/scenarios")
async def create_scenario(
    body: dict[str, Any], broadcast: bool = True, ctx: AppContext = Depends(get_ctx)
) -> JSONResponse:
    """broadcast=false: «σιωπηλή» εξερεύνηση παραλλαγών από τον agent (δεν αλλάζει η οθόνη)."""
    body.setdefault("id", f"s-{uuid.uuid4().hex[:10]}")
    try:
        Scenario.model_validate(body)
    except ValidationError as exc:
        raise HTTPException(422, exc.errors(include_url=False)) from exc
    result, source = await run_scenario(ctx, body, broadcast)
    return JSONResponse(result, headers={"X-Athena-Source": source})


@router.get("/scenarios/{scenario_id}")
async def get_scenario(scenario_id: str, ctx: AppContext = Depends(get_ctx)) -> dict[str, Any]:
    async with ctx.db.engine.connect() as conn:
        row = (await conn.execute(select(tables.scenarios).where(tables.scenarios.c.id == scenario_id))).first()
    if not row:
        raise HTTPException(404, "Άγνωστο σενάριο")
    return row.data


@router.get("/scenarios/{scenario_id}/result")
async def get_result(scenario_id: str, ctx: AppContext = Depends(get_ctx)) -> dict[str, Any]:
    if scenario_id in last_results:
        return last_results[scenario_id]
    async with ctx.db.engine.connect() as conn:
        row = (await conn.execute(select(tables.scenarios).where(tables.scenarios.c.id == scenario_id))).first()
    if row:
        cached = await _cached(ctx, row.data, row.hash)
        if cached:
            return {**cached, "scenarioId": scenario_id}
    raise HTTPException(404, "Δεν υπάρχει αποτέλεσμα για αυτό το σενάριο")


_backtests = TypeAdapter(list[Backtest])


@router.get("/backtests")
async def backtests(ctx: AppContext = Depends(get_ctx)) -> JSONResponse:
    if ctx.settings.mock:
        return JSONResponse(ctx.fixture("backtests.json"), headers={"X-Athena-Source": "mock"})
    cache = ctx.demo_path("cache", "backtests.json")
    try:
        r = await ctx.http.get(f"{ctx.settings.sim_url}/backtests", timeout=5.0)
        r.raise_for_status()
        data = r.json()
        _backtests.validate_python(data)
        with contextlib.suppress(OSError):
            cache.parent.mkdir(parents=True, exist_ok=True)
            cache.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        return JSONResponse(data, headers={"X-Athena-Source": "live"})
    except (httpx.HTTPError, ValueError, ValidationError) as exc:
        if cache.exists():
            ctx.status.fallback(f"Backtests: ο sim δεν απάντησε ({exc.__class__.__name__}) → cached")
            return JSONResponse(json.loads(cache.read_text(encoding="utf-8")), headers={"X-Athena-Source": "fallback"})
        raise HTTPException(503, "Τα backtests δεν είναι διαθέσιμα") from exc


@router.get("/network")
async def network(ctx: AppContext = Depends(get_ctx)) -> JSONResponse:
    """Οδικό δίκτυο (GeoJSON, wayId ανά δρόμο) από τον sim, για να φωτίζει το web τους δρόμους του σεναρίου."""
    if ctx.settings.mock:
        return JSONResponse(ctx.fixture("network.geojson"), headers={"X-Athena-Source": "mock"})
    cache = ctx.demo_path("cache", "network.json")
    try:
        r = await ctx.http.get(f"{ctx.settings.sim_url}/network", timeout=10.0)
        r.raise_for_status()
        data = r.json()
        if not data.get("features"):
            raise ValueError("κενό δίκτυο")
        with contextlib.suppress(OSError):
            cache.parent.mkdir(parents=True, exist_ok=True)
            cache.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        return JSONResponse(data, headers={"X-Athena-Source": "live"})
    except (httpx.HTTPError, ValueError) as exc:
        if cache.exists():
            return JSONResponse(json.loads(cache.read_text(encoding="utf-8")), headers={"X-Athena-Source": "fallback"})
        raise HTTPException(503, "Το οδικό δίκτυο δεν είναι διαθέσιμο") from exc
