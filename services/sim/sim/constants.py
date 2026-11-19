"""
Constants for ATHENA-OS simulation service.
All coordinates WGS84. Bbox = demo area (Πειραιώς/Γκάζι/Κεραμεικός/Θησείο).
"""
from __future__ import annotations
from pathlib import Path
import os

# ── Spatial ─────────────────────────────────────────────────────────────────
# (min_lng, min_lat, max_lng, max_lat) — roughly 3×2 km
DEMO_BBOX = (23.700, 37.970, 23.730, 37.990)
# Extra margin for OSM fetch so boundary roads have full context
DEMO_BBOX_BUFFER_DEG = 0.003   # ~250 m

# Reference landmark: Σεράφειο (Πειραιώς 144 / Εχελιδών 19)
# Coordinates verified from OSM graph (Πειραιώς primary corridor node)
SERAFEIO_LNGLAT = (23.7125, 37.9764)
SERAFEIO_NODE_APPROX = None   # filled at startup from actual graph

# ── BPR (Bureau of Public Roads) ────────────────────────────────────────────
BPR_ALPHA = 0.15
BPR_BETA = 4.0

# ── Road capacity (veh/h/lane) by OSM highway type ──────────────────────────
CAPACITY_PER_LANE: dict[str, float] = {
    "motorway": 2200.0,
    "motorway_link": 1800.0,
    "trunk": 1900.0,
    "trunk_link": 1500.0,
    "primary": 1800.0,
    "primary_link": 1400.0,
    "secondary": 1600.0,
    "secondary_link": 1300.0,
    "tertiary": 1400.0,
    "tertiary_link": 1100.0,
    "residential": 900.0,
    "living_street": 600.0,
    "unclassified": 1000.0,
    "service": 600.0,
}

DEFAULT_LANES: dict[str, int] = {
    "motorway": 3,
    "motorway_link": 2,
    "trunk": 2,
    "trunk_link": 1,
    "primary": 2,
    "primary_link": 1,
    "secondary": 2,
    "secondary_link": 1,
    "tertiary": 1,
    "tertiary_link": 1,
    "residential": 1,
    "living_street": 1,
    "unclassified": 1,
    "service": 1,
}

# ── Building height defaults (m) by OSM building tag ────────────────────────
BUILDING_HEIGHT_DEFAULTS: dict[str, float] = {
    "apartments": 15.0,
    "residential": 9.6,
    "commercial": 12.0,
    "industrial": 6.4,
    "retail": 4.8,
    "office": 18.0,
    "warehouse": 8.0,
    "school": 9.6,
    "church": 12.0,
    "yes": 10.0,
    "": 10.0,
}
BUILDING_LEVELS_TO_HEIGHT_M = 3.2   # per floor

# ── Thermal grid ─────────────────────────────────────────────────────────────
THERMAL_GRID_RESOLUTION_M = 25.0
M_PER_DEG_LAT = 111320.0
M_PER_DEG_LNG_AT_38 = 87850.0   # at lat ≈ 38°

# Athens timezone offset for pvlib (UTC+2 in summer / UTC+3 EEST)
ATHENS_TZ = "Europe/Athens"

# ── Tree canopy (add_trees scenario) ─────────────────────────────────────────
TREE_CANOPY_RADIUS_M = 4.0        # 8 m diameter canopy
TREE_NDVI_BOOST_CENTER = 0.35     # NDVI increase at canopy center
TREE_SHADE_PEAK = 0.70            # max shade fraction under canopy

# ── Cool pavement (cool_pavement scenario) ───────────────────────────────────
COOL_PAVEMENT_ALBEDO_BOOST = 0.15

# ── COPERT simplified CO₂ emission factor (kg / veh·km) ─────────────────────
# Parabolic in [10, 120] km/h, minimum at ~80 km/h
COPERT_A = 0.0010   # coefficient for v² term
COPERT_B = -0.1600  # coefficient for v term
COPERT_C = 11.000   # constant term → divide by 1000 to get kg/km at urban speeds
# CO₂(v) = (COPERT_A*v² + COPERT_B*v + COPERT_C) / 1000  kg/veh·km
# e.g. v=30: (0.001*900 - 0.16*30 + 11)/1000 = (0.9 - 4.8 + 11)/1000 = 7.1/1000 ≈ too big
# Simpler: use lookup-style
COPERT_EMISSIONS_KG_KM: dict[int, float] = {
    10: 0.350, 20: 0.270, 30: 0.230, 40: 0.210,
    50: 0.200, 60: 0.195, 70: 0.192, 80: 0.190,
    90: 0.192, 100: 0.197, 110: 0.205, 120: 0.218,
}

# ── Frank-Wolfe ───────────────────────────────────────────────────────────────
FW_N_ITER_BASE = 20           # reduced for demo speed (SSSP-batched, converges early)
FW_N_ITER_SCENARIO = 4       # warm-start from base → converges in 2–4 iters
FW_CONVERGENCE_GAP = 1e-3    # 0.1% gap — sufficient for demo

# ── Monte Carlo ───────────────────────────────────────────────────────────────
# Instead of 30 full runs, we use 3 demand levels (demand × scale) to get
# p10/p50/p90 — fast and defensible as a sensitivity analysis
MC_DEMAND_SCALES = (0.85, 1.00, 1.15)   # → p10, p50, p90

# ── Paths (overridable via env vars) ─────────────────────────────────────────
_SIM_DIR = Path(__file__).resolve().parent.parent   # services/sim/
_PROJECT_ROOT = _SIM_DIR.parent.parent               # project root

DATA_PROCESSED_DIR = Path(
    os.getenv("DATA_PROCESSED_DIR", str(_PROJECT_ROOT / "data" / "processed"))
)
DEMO_CACHE_DIR = Path(
    os.getenv("DEMO_CACHE_DIR", str(_PROJECT_ROOT / "data" / "cache"))
)
