"""
Auto-generated Pydantic models from packages/contracts/schemas/*.json
Source of truth: JSON Schemas (packages/contracts/schemas/)
DO NOT EDIT — re-generate with: cd packages/contracts && npm run generate

For now this re-exports from services/sim/sim/models.py which is the
primary definition until the JSON Schemas and generator are set up.
"""
from __future__ import annotations

# Re-export all contract types (single source of truth = services/sim/sim/models.py)
from pathlib import Path
import sys
_sim_path = str(Path(__file__).resolve().parents[4] / "services" / "sim")
if _sim_path not in sys.path:
    sys.path.insert(0, _sim_path)

from sim.models import (   # noqa: F401
    LngLat,
    Range,
    EditCloseRoad,
    EditBusLane,
    EditRemoveLane,
    EditAddTrees,
    EditCoolPavement,
    ScenarioEdit,
    Scenario,
    TrafficSegment,
    Trip,
    TrafficPart,
    ThermalCell,
    ThermalPart,
    EmissionsPart,
    SimResult,
    ChartPoint,
    Backtest,
    ResolveMatch,
    ResolveResponse,
    HealthResponse,
)
