"""
ATHENA-OS Simulation Service — services/sim
Port 8100  |  FastAPI stateless  |  MOCK=1 for instant startup

Endpoints:
  POST /simulate          Scenario → SimResult
  GET  /backtests         → Backtest[]
  GET  /network           → GeoJSON (road segments with wayId, name, lanes, maxspeed)
  GET  /resolve?q=...     → wayIds matching a street name (fuzzy)
  GET  /thermal/frame     → thermal cells for the slider (no scenario)
  GET  /health
"""
from __future__ import annotations
import asyncio
import logging
import os
import time
from contextlib import asynccontextmanager
from functools import partial

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from sim.models import (
    Scenario, SimResult, Backtest, HealthResponse, ResolveResponse, ResolveMatch,
    TrafficPart, ThermalPart, EmissionsPart, Range,
)
from sim.constants import DEMO_CACHE_DIR
from sim.cache import scenario_hash, get_cached, put_cached
from sim import mock as _mock
from sim import backtests as _backtests

log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")

MOCK = os.getenv("MOCK", "1").strip() not in ("0", "false", "False")


# ── App state ─────────────────────────────────────────────────────────────────

class AppState:
    graph = None
    backtests_cache: list[Backtest] = []
    ready: bool = False


state = AppState()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load graph, models, backtests at startup."""
    if MOCK:
        log.info("MOCK=1 — starting in mock mode (no data loading)")
        state.backtests_cache = _backtests.load_backtests()   # returns mock backtests
        state.ready = True
    else:
        log.info("Loading simulation data…")
        loop = asyncio.get_event_loop()
        try:
            await loop.run_in_executor(None, _load_all)
            state.ready = True
            log.info("Simulation service ready.")
        except Exception as e:
            log.error("Failed to load simulation data: %s — /simulate απαντά 503 (ο gateway δείχνει cached)", e)
            state.backtests_cache = _backtests.load_backtests()
            state.ready = True
    yield
    log.info("Sim service shutting down.")


def _load_all() -> None:
    """Heavy I/O: run in executor thread."""
    from sim import network as net
    from sim import thermal as thm
    from sim import traffic as trf

    log.info("Loading OSM graph…")
    G = net.load_graph()
    state.graph = G

    log.info("Loading thermal grid and model…")
    thm.load_base_grid()
    thm.load_or_train_model()

    log.info("Pre-computing base traffic assignment (warm-starts scenarios)…")
    trf.ensure_base_assignment(G)

    log.info("Loading backtests…")
    state.backtests_cache = _backtests.load_backtests()


# ── FastAPI app ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="ATHENA-OS Sim Service",
    version="0.1.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── POST /simulate ────────────────────────────────────────────────────────────

@app.post("/simulate", response_model=SimResult)
async def simulate(scenario: Scenario) -> SimResult:
    """
    Run traffic + thermal simulation for a scenario.
    Returns SimResult with p10/p50/p90 uncertainty ranges.
    <5s for warm-started scenarios (pre-computed base assignment).
    """
    h = scenario_hash(scenario)

    if MOCK:
        # Ποτέ στο cache: αλλιώς τα fixtures σερβίρονται αργότερα ως «live» αποτελέσματα
        return _mock.build_mock_sim_result(scenario.id)
    if state.graph is None:
        raise HTTPException(status_code=503, detail="Τα δεδομένα του sim δεν φορτώθηκαν (MOCK=0)")

    cached = get_cached(h)
    if cached:
        log.info("Cache hit for scenario %s (hash=%s)", scenario.id, h)
        return cached.model_copy(update={"scenarioId": scenario.id})

    t_start = time.perf_counter()
    loop = asyncio.get_event_loop()
    try:
        result = await loop.run_in_executor(None, partial(_run_simulation, scenario))
    except Exception as e:
        log.exception("Simulation failed for scenario %s", scenario.id)
        raise HTTPException(status_code=500, detail=f"Simulation failed: {e}")

    put_cached(h, result)
    log.info(
        "Scenario %s done in %.1fs (hash=%s)",
        scenario.id, time.perf_counter() - t_start, h,
    )
    return result


def _run_simulation(scenario: Scenario) -> SimResult:
    """
    Blocking simulation — runs in thread pool.
    Combines traffic + thermal results.
    """
    from sim import network as net
    from sim import traffic as trf
    from sim import thermal as thm

    t_start = time.perf_counter()

    # Apply scenario edits to graph copy
    G_base = state.graph
    G_scenario = net.apply_edits_to_graph(G_base, scenario.edits)

    # Traffic simulation
    traffic_part, traffic_ms, co2_range, traffic_notes = trf.simulate_traffic(G_scenario, G_base, scenario)

    # Thermal simulation
    cool_ways = [w for e in scenario.edits if e.type == "cool_pavement" for w in e.wayIds]
    cool_points = net.way_points(G_base, cool_ways) if cool_ways else None
    thermal_part, thermal_ms = thm.simulate_thermal(scenario, cool_points)

    total_ms = int((time.perf_counter() - t_start) * 1000)

    notes = [
        "Ανάθεση κυκλοφορίας: στατική ισορροπία χρήστη (Frank-Wolfe, BPR α=0.15, β=4).",
        "Ζήτηση: συνθετικός πίνακας OD (μοντέλο βαρύτητας), όχι βαθμονομημένος με μετρήσεις: δεν υπάρχουν αισθητήρες στην περιοχή.",
        "Αβεβαιότητα κυκλοφορίας: ζήτηση ×0.85 / ×1.00 / ×1.15, κάθε επίπεδο απέναντι στη δική του βάση → p10/p50/p90.",
        *traffic_notes,
        "Θερμικό: εκτίμηση θερμοκρασίας επιφάνειας εδάφους, ΟΧΙ θερμοκρασία αέρα (~8–15°C χαμηλότερη).",
        "Αβεβαιότητα θερμικού: συντελεστές σκιάς (8–16 °C σε πλήρη σκιά) και albedo ×2/3 … ×4/3 → p10/p90.",
        f"Χρόνος υπολογισμού: {total_ms} ms (κυκλοφορία {traffic_ms} ms, θερμικό {thermal_ms} ms).",
    ]
    # Add any scenario-specific notes
    for edit in scenario.edits:
        match edit.type:
            case "add_trees":
                notes.append(
                    f"Δέντρα: {edit.count} δέντρα, κόμη ~{int(2*4)}m διάμετρο, "
                    f"πλευρά {edit.side or 'και οι δύο'}. "
                    "Αποτέλεσμα: αύξηση σκιάς + NDVI στα κελιά εντός κόμης."
                )
            case "cool_pavement":
                notes.append(f"Cool pavement: albedo +0.15 μόνο στα κελιά των wayIds {edit.wayIds}.")
            case "close_road":
                notes.append(f"Κλείσιμο δρόμου: wayIds {edit.wayIds} αφαιρέθηκαν από τον γράφο.")
            case "bus_lane":
                notes.append(f"Λωρίδα λεωφορείου: wayIds {edit.wayIds} → μείωση χωρητικότητας κατά 1 λωρίδα ΙΧ.")
            case "remove_lane":
                notes.append(f"Αφαίρεση λωρίδας: wayIds {edit.wayIds} → μία λωρίδα ΙΧ λιγότερη (μένει πάντα ≥ 1).")

    return SimResult(
        scenarioId=scenario.id,
        status="ok",
        computeMs=total_ms,
        traffic=traffic_part,
        thermal=thermal_part,
        emissions=EmissionsPart(co2DeltaPct=co2_range),
        notes=notes,
    )


# ── GET /backtests ────────────────────────────────────────────────────────────

@app.get("/backtests", response_model=list[Backtest])
async def get_backtests() -> list[Backtest]:
    return state.backtests_cache


# ── GET /network ──────────────────────────────────────────────────────────────

@app.get("/network")
async def get_network() -> JSONResponse:
    """
    GeoJSON FeatureCollection of road segments in the demo bbox.
    Each feature: {wayId, name, name_en, lanes, maxspeed, highway}
    """
    if MOCK or state.graph is None:
        return JSONResponse(_mock.build_mock_network_geojson())

    from sim import network as net
    df = net.get_edges_df()
    G = state.graph
    features = []
    for _, row in df.iterrows():
        u, v, k = int(row["u"]), int(row["v"]), int(row["k"])
        try:
            u_data = G.nodes[u]
            v_data = G.nodes[v]
            coords = [[u_data["x"], u_data["y"]], [v_data["x"], v_data["y"]]]
        except KeyError:
            continue
        features.append({
            "type": "Feature",
            "properties": {
                "wayId": int(row["wayId"]),
                "name": row["name"],
                "name_en": row["name_en"],
                "lanes": int(row["lanes"]),
                "maxspeed": row["maxspeed"],
                "highway": row["highway"],
            },
            "geometry": {"type": "LineString", "coordinates": coords},
        })
    return JSONResponse({"type": "FeatureCollection", "features": features})


# ── GET /resolve ──────────────────────────────────────────────────────────────

@app.get("/resolve", response_model=ResolveResponse)
async def resolve(q: str = Query(..., description="Όνομα δρόμου (ελληνικά ή λατινικά)")) -> ResolveResponse:
    """
    Fuzzy name resolution: «Πειραιώς» → list of matching wayIds.
    Boosts results near Σεράφειο.
    """
    if MOCK or state.graph is None:
        # Return mock matches for Πειραιώς
        return ResolveResponse(matches=[
            ResolveMatch(wayId=10001, name="Πειραιώς", score=0.95, distM=120.0),
            ResolveMatch(wayId=10002, name="Πειραιώς", score=0.95, distM=180.0),
        ])

    from sim import network as net
    matches_raw = net.resolve_query(q, top_k=10)
    matches = [
        ResolveMatch(
            wayId=m["wayId"], name=m["name"],
            score=m["score"], distM=m["distM"],
        )
        for m in matches_raw
    ]
    return ResolveResponse(matches=matches)


# ── GET /thermal/frame ────────────────────────────────────────────────────────

@app.get("/thermal/frame")
async def thermal_frame(when: str = Query(..., description="ISO datetime για τον slider")) -> JSONResponse:
    """
    Baseline thermal cells at a given time (no scenario).
    Used by the time slider to show temperature evolution.
    """
    if MOCK or state.graph is None:
        cells = _mock.build_mock_thermal_frame(when)
        return JSONResponse({"when": when, "cells": cells})

    loop = asyncio.get_event_loop()
    from sim import thermal as thm
    try:
        cells = await loop.run_in_executor(None, partial(thm.compute_thermal_frame, when))
        return JSONResponse({
            "when": when,
            "cells": [{"lngLat": list(c.lngLat), "baseC": c.baseC, "newC": c.newC} for c in cells],
        })
    except Exception as e:
        log.exception("Thermal frame failed for when=%s", when)
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /health ───────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    if MOCK:
        return HealthResponse(
            status="ok", mock=True,
            graph_nodes=None, graph_edges=None,
            thermal_model="mock",
            backtests_ready=len(state.backtests_cache) > 0,
        )
    if not state.ready or state.graph is None:
        return HealthResponse(status="degraded", mock=False, backtests_ready=False)

    from sim import network as net
    from sim import thermal as thm
    stats = net.graph_stats()
    return HealthResponse(
        status="ok",
        mock=False,
        graph_nodes=stats.get("nodes"),
        graph_edges=stats.get("edges"),
        thermal_model=thm.model_type(),
        backtests_ready=len(state.backtests_cache) > 0,
    )


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8100"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
