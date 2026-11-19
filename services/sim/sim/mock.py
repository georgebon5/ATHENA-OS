"""
Mock responses for MOCK=1 mode.
All coordinates are realistic for the Πειραιώς/Σεράφειο demo area.
wayIds use short placeholder IDs (10xxx) — real OSM IDs come from fetch_all.py.
"""
from __future__ import annotations
import json
from pathlib import Path
from .models import (
    SimResult, TrafficPart, ThermalPart, EmissionsPart,
    TrafficSegment, ThermalCell, Trip, Range, Backtest, ChartPoint,
)
from .constants import DEMO_CACHE_DIR

# ── Coordinate anchors for Πειραιώς corridor ─────────────────────────────────
# Real OSM positions verified from network.graphml (fetch_all.py --step osm).
# Piraeus St runs roughly N–S in our bbox.
# Southern end near Iera Odos / Thissio: wayId=217698402  lng≈23.711, lat≈37.975
# Serafeio / Echelidon area:             wayId=652510532  lng≈23.712, lat≈37.976
# Northern end near Metaxourgio:         wayId=217698400  lng≈23.713, lat≈37.977

_SEG_A_PATH = [(23.7108, 37.9748), (23.7115, 37.9758), (23.7120, 37.9764)]
_SEG_B_PATH = [(23.7120, 37.9764), (23.7128, 37.9772), (23.7135, 37.9780)]
_SEG_C_PATH = [(23.7135, 37.9780), (23.7148, 37.9785)]

# Side streets that pick up diverted traffic in bus_lane scenario
_SIDE_A_PATH = [(23.7108, 37.9748), (23.7098, 37.9755), (23.7090, 37.9765)]
_SIDE_B_PATH = [(23.7135, 37.9780), (23.7148, 37.9790)]


def _make_trips(n: int = 60) -> list[Trip]:
    """Sample vehicle trips along the corridor for Cesium animation."""
    import random
    rng = random.Random(42)
    trips: list[Trip] = []
    # Main corridor trips (N-bound and S-bound)
    for i in range(n // 2):
        depart = rng.uniform(0, 300)
        dur = rng.uniform(45, 120)
        trips.append(Trip(path=_SEG_A_PATH + _SEG_B_PATH, departS=depart, durationS=dur))
        trips.append(Trip(path=list(reversed(_SEG_B_PATH + _SEG_A_PATH)), departS=depart + 15, durationS=dur))
    return trips


def _thermal_cells() -> list[ThermalCell]:
    """25 m grid covering the Σεράφειο hotspot — before & after scenario."""
    import numpy as np
    rng = np.random.default_rng(7)
    cells = []
    # ~3×5 patch around Serafeio (real anchor: 23.7125, 37.9764)
    for dlng in [-0.001, 0.0, 0.001]:
        for dlat in [-0.002, -0.001, 0.0, 0.001, 0.002]:
            base = 36.5 + rng.normal(0, 1.2)      # realistic Athens summer LST
            new_c = base - rng.uniform(1.5, 3.5)   # post-scenario improvement
            cells.append(ThermalCell(
                lngLat=(round(23.7125 + dlng, 6), round(37.9764 + dlat, 6)),
                baseC=round(base, 2),
                newC=round(new_c, 2),
            ))
    return cells


def build_mock_sim_result(scenario_id: str = "mock-s-001") -> SimResult:
    return SimResult(
        scenarioId=scenario_id,
        status="ok",
        computeMs=1840,
        traffic=TrafficPart(
            segments=[
                TrafficSegment(wayId=217698402, baseFlow=1240, newFlow=1080,
                               baseTimeS=68, newTimeS=61, path=_SEG_A_PATH),
                TrafficSegment(wayId=652510532, baseFlow=1180, newFlow=1020,
                               baseTimeS=72, newTimeS=65, path=_SEG_B_PATH),
                TrafficSegment(wayId=217698400, baseFlow=840,  newFlow=740,
                               baseTimeS=40, newTimeS=37, path=_SEG_C_PATH),
                # Side-street overflow (small positive effect on diverted traffic)
                TrafficSegment(wayId=734712545, baseFlow=320, newFlow=390,
                               baseTimeS=55, newTimeS=60, path=_SIDE_A_PATH),
            ],
            corridorTravelTimeDeltaPct=Range(p10=-7.2, p50=-4.1, p90=-1.3),
            vehicleKmDeltaPct=Range(p10=-5.8, p50=-2.9, p90=0.2),
            trips=_make_trips(60),
        ),
        thermal=ThermalPart(
            when="2026-07-15T13:00:00+03:00",
            cells=_thermal_cells(),
            hotspotDeltaC=Range(p10=-3.4, p50=-2.3, p90=-1.0),
        ),
        emissions=EmissionsPart(
            co2DeltaPct=Range(p10=-5.1, p50=-2.5, p90=0.3),
        ),
        notes=[
            "Προσομοίωση βασισμένη σε συνθετικό OD πίνακα (MOCK MODE).",
            "Εκτίμηση θερμοκρασίας επιφάνειας εδάφους (~θερμοκρασία που νιώθει ο πεζός σε ηλιόλουστο πεζοδρόμιο), ΟΧΙ θερμοκρασία αέρα.",
            "BPR α=0.15, β=4. Αβεβαιότητα από ±15% διαταραχή ζήτησης.",
            "Σενάριο: λωρίδα λεωφορείου + 42 δέντρα νότια πλευρά Πειραιώς.",
        ],
    )


def build_mock_backtests() -> list[Backtest]:
    """
    Realistic-looking backtest results.
    Traffic MAPE ~16% is honest for synthetic OD without real sensor calibration.
    Thermal MAE ~1.9°C, R²~0.70 is honest for a ridge regression on 1 Landsat scene.
    """
    import random
    rng = random.Random(99)

    # Traffic: scatter plot predicted vs observed flow at mock sensors
    traffic_chart: list[ChartPoint] = []
    for obs in range(200, 1600, 100):
        noise = rng.gauss(0, obs * 0.16)
        traffic_chart.append(ChartPoint(predicted=round(obs + noise, 1), observed=float(obs)))

    # Thermal: scatter plot predicted vs observed LST
    thermal_chart: list[ChartPoint] = []
    for obs_lst in range(28, 56, 2):
        noise = rng.gauss(0, 1.9)
        thermal_chart.append(ChartPoint(predicted=round(obs_lst + noise, 2), observed=float(obs_lst)))

    return [
        Backtest(
            model="traffic",
            metric="MAPE",
            value=16.3,
            heldOut="Τρίτη 17/11/2026, 07:00–10:00",
            nSamples=len(traffic_chart),
            chart=traffic_chart,
        ),
        Backtest(
            model="thermal",
            metric="MAE_C",
            value=1.87,
            heldOut="Landsat 9 — 14/07/2025 10:12 UTC",
            nSamples=len(thermal_chart),
            chart=thermal_chart,
        ),
        Backtest(
            model="thermal",
            metric="R2",
            value=0.71,
            heldOut="Landsat 9 — 14/07/2025 10:12 UTC",
            nSamples=len(thermal_chart),
            chart=thermal_chart,
        ),
    ]


def build_mock_network_geojson() -> dict:
    """GeoJSON FeatureCollection of the demo road segments (mock wayIds)."""
    features = [
        {
            "type": "Feature",
            "properties": {"wayId": 217698402, "name": "Πειραιώς", "name_en": "Pireos",
                           "lanes": 2, "maxspeed": 50, "highway": "primary"},
            "geometry": {"type": "LineString",
                         "coordinates": [list(p) for p in _SEG_A_PATH]},
        },
        {
            "type": "Feature",
            "properties": {"wayId": 652510532, "name": "Πειραιώς", "name_en": "Pireos",
                           "lanes": 4, "maxspeed": 50, "highway": "primary"},
            "geometry": {"type": "LineString",
                         "coordinates": [list(p) for p in _SEG_B_PATH]},
        },
        {
            "type": "Feature",
            "properties": {"wayId": 217698400, "name": "Πειραιώς", "name_en": "Pireos",
                           "lanes": 3, "maxspeed": 50, "highway": "primary"},
            "geometry": {"type": "LineString",
                         "coordinates": [list(p) for p in _SEG_C_PATH]},
        },
        {
            "type": "Feature",
            "properties": {"wayId": 734712545, "name": "Πειραιώς", "name_en": "Pireos",
                           "lanes": 3, "maxspeed": 50, "highway": "primary"},
            "geometry": {"type": "LineString",
                         "coordinates": [list(p) for p in _SIDE_A_PATH]},
        },
        {
            "type": "Feature",
            "properties": {"wayId": 217698401, "name": "Πειραιώς", "name_en": "Pireos",
                           "lanes": 2, "maxspeed": 50, "highway": "primary"},
            "geometry": {"type": "LineString",
                         "coordinates": [list(p) for p in _SIDE_B_PATH]},
        },
    ]
    return {"type": "FeatureCollection", "features": features}


def build_mock_thermal_frame(when: str) -> list[dict]:
    """Thermal cells for the slider (no scenario — just baseline)."""
    cells = _thermal_cells()
    # Return as plain dicts (FastAPI will serialize)
    return [{"lngLat": list(c.lngLat), "baseC": c.baseC, "newC": c.baseC} for c in cells]


def load_or_build_cached_result(scenario_id: str, scenario_hash: str) -> SimResult | None:
    """Check demo/cache/ for a pre-computed result matching the hash."""
    cache_file = DEMO_CACHE_DIR / f"{scenario_hash}.json"
    if cache_file.exists():
        try:
            data = json.loads(cache_file.read_text())
            return SimResult.model_validate(data)
        except Exception:
            pass
    return None
