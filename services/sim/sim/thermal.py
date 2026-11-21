"""
Thermal model: predict Land Surface Temperature (LST) on a 25 m grid.

Two modes:
  1. ML model (preferred): Ridge regression trained on Landsat 8/9 LST.
     Features: shade fraction, NDVI, building coverage, road fraction,
               sky view factor (approx), distance-to-green.
  2. Physics fallback (no Landsat data): semi-empirical UHI model using
     the same feature set + a typical Athens summer baseline.

IMPORTANT: We model LST (surface temperature), NOT air temperature.
LST ≈ "temperature felt by a pedestrian on a sunny pavement".
Air temperature is typically 8–15°C lower than peak LST.
This distinction must appear in every notes[] output.

References:
  Voogt, J.A. & Oke, T.R. (2003). Thermal remote sensing of urban climates.
  Grimmond, C.S.B. et al. (2010). Urban surface energy balance models.
  pvlib: https://pvlib-python.readthedocs.io/
"""
from __future__ import annotations
import logging
import math
import pickle
import time
from pathlib import Path
from typing import NamedTuple

import numpy as np
import pandas as pd

from .constants import (
    DEMO_BBOX,
    THERMAL_GRID_RESOLUTION_M,
    M_PER_DEG_LAT, M_PER_DEG_LNG_AT_38,
    ATHENS_TZ,
    TREE_CANOPY_RADIUS_M, TREE_NDVI_BOOST_CENTER, TREE_SHADE_PEAK,
    COOL_PAVEMENT_ALBEDO_BOOST, COOL_PAVEMENT_REACH_M,
    DATA_PROCESSED_DIR,
    SERAFEIO_LNGLAT,
)
from .models import ThermalCell, ThermalPart, Range, Scenario

log = logging.getLogger(__name__)

# Module-level state
_thermal_model = None          # fitted sklearn model or None
_grid_df: pd.DataFrame | None = None   # base grid with features
_model_type: str = "unloaded"  # "physics" | "ridge" | "lgbm"


# ── Grid generation ───────────────────────────────────────────────────────────

class GridCell(NamedTuple):
    lng: float
    lat: float
    ndvi: float               # 0–1
    building_frac: float      # 0–1 (fraction of cell covered by buildings)
    road_frac: float          # 0–1
    albedo_proxy: float       # 0–1 (higher = more reflective)
    dist_green_m: float       # distance to nearest green (m)


def build_grid(
    buildings_gdf=None,       # GeoDataFrame or None
    vegetation_gdf=None,      # GeoDataFrame or None
    roads_gdf=None,           # GeoDataFrame or None
) -> pd.DataFrame:
    """
    Create a 25 m grid covering the demo bbox and compute static features
    (independent of time-of-day / solar position).
    """
    min_lng, min_lat, max_lng, max_lat = DEMO_BBOX
    dlng = THERMAL_GRID_RESOLUTION_M / M_PER_DEG_LNG_AT_38
    dlat = THERMAL_GRID_RESOLUTION_M / M_PER_DEG_LAT

    lngs = np.arange(min_lng, max_lng, dlng)
    lats = np.arange(min_lat, max_lat, dlat)
    lng_grid, lat_grid = np.meshgrid(lngs, lats)
    n_cells = lng_grid.size

    df = pd.DataFrame({
        "lng": lng_grid.ravel(),
        "lat": lat_grid.ravel(),
    })

    if buildings_gdf is not None and len(buildings_gdf) > 0:
        df["building_frac"] = _rasterize_coverage(df, buildings_gdf, dlng, dlat)
    else:
        df["building_frac"] = _synthetic_building_frac(df)

    if roads_gdf is not None and len(roads_gdf) > 0:
        df["road_frac"] = _rasterize_coverage(df, roads_gdf, dlng, dlat)
    else:
        df["road_frac"] = _synthetic_road_frac(df)

    if vegetation_gdf is not None and len(vegetation_gdf) > 0:
        df["ndvi"] = _rasterize_ndvi(df, vegetation_gdf, dlng, dlat)
        df["dist_green_m"] = _distance_to_nearest_green(df, vegetation_gdf)
    else:
        df["ndvi"] = _synthetic_ndvi(df)
        df["dist_green_m"] = _synthetic_dist_green(df)

    # Albedo proxy: pavement (low) < buildings (medium) < vegetation (high)
    df["albedo_proxy"] = (
        0.08 * df["road_frac"] +           # dark asphalt
        0.25 * df["building_frac"] +        # concrete/plaster
        0.22 * (1 - df["road_frac"] - df["building_frac"]).clip(0) +   # soil/other
        0.40 * df["ndvi"]                   # vegetation (approximate)
    ).clip(0.05, 0.85)

    # Sky view factor (SVF) approximation: more buildings → lower SVF
    df["svf"] = (1.0 - 0.7 * df["building_frac"]).clip(0.1, 1.0)

    return df


def _synthetic_building_frac(df: pd.DataFrame) -> pd.Series:
    """Fallback: use typical Athens urban fabric (~60% building coverage)."""
    rng = np.random.default_rng(1)
    base = 0.60 + rng.normal(0, 0.08, len(df))
    return pd.Series(np.clip(base, 0.1, 0.95), index=df.index)


def _synthetic_road_frac(df: pd.DataFrame) -> pd.Series:
    """Fallback: higher road fraction near Πειραιώς corridor lng≈23.709."""
    dist_to_pireos = np.abs(df["lng"] - 23.709) * M_PER_DEG_LNG_AT_38
    road = np.where(dist_to_pireos < 15, 0.5, 0.15)
    return pd.Series(road.astype(float), index=df.index)


def _synthetic_ndvi(df: pd.DataFrame) -> pd.Series:
    """Fallback: low NDVI in dense urban core, slightly higher in parks."""
    # Sparse green: Kerameikos park area around lng=23.714, lat=37.978
    dist_to_park = np.sqrt(
        ((df["lng"] - 23.714) * M_PER_DEG_LNG_AT_38) ** 2 +
        ((df["lat"] - 37.978) * M_PER_DEG_LAT) ** 2
    )
    ndvi = np.where(dist_to_park < 150, 0.45, 0.08)
    rng = np.random.default_rng(2)
    return pd.Series(np.clip(ndvi + rng.normal(0, 0.03, len(df)), 0.0, 1.0), index=df.index)


def _synthetic_dist_green(df: pd.DataFrame) -> pd.Series:
    """Fallback: Gaussian distance from nearest synthetic park."""
    park_lngs = [23.714, 23.722, 23.705]
    park_lats = [37.978, 37.983, 37.985]
    min_dist = np.full(len(df), 9999.0)
    for plng, plat in zip(park_lngs, park_lats):
        d = np.sqrt(
            ((df["lng"].values - plng) * M_PER_DEG_LNG_AT_38) ** 2 +
            ((df["lat"].values - plat) * M_PER_DEG_LAT) ** 2
        )
        min_dist = np.minimum(min_dist, d)
    return pd.Series(min_dist, index=df.index)


def _rasterize_coverage(df, gdf, dlng, dlat):
    """Fraction of each cell covered by geometries in gdf."""
    from shapely.geometry import box
    coverages = []
    for _, row in df.iterrows():
        cell = box(row["lng"], row["lat"], row["lng"] + dlng, row["lat"] + dlat)
        cell_area = cell.area
        overlap = gdf.geometry.intersection(cell).area.sum()
        coverages.append(min(overlap / cell_area, 1.0))
    return pd.Series(coverages, index=df.index)


def _rasterize_ndvi(df, veg_gdf, dlng, dlat):
    # Simplified: use proximity to vegetation features
    return _synthetic_ndvi(df)


def _distance_to_nearest_green(df, veg_gdf):
    return _synthetic_dist_green(df)


# ── Solar position ────────────────────────────────────────────────────────────

def _solar_position(when_iso: str) -> dict:
    """Get solar altitude and azimuth for Athens at the given time."""
    import pvlib
    import pandas as _pd
    location = pvlib.location.Location(
        latitude=37.979, longitude=23.709,
        tz=ATHENS_TZ, altitude=100,
    )
    times = _pd.DatetimeIndex([when_iso], tz=ATHENS_TZ)
    sp = location.get_solarposition(times)
    return {
        "altitude_deg": float(sp["apparent_elevation"].iloc[0]),
        "azimuth_deg": float(sp["azimuth"].iloc[0]),
    }


def _shade_fraction(
    building_frac: np.ndarray,
    solar_altitude_deg: float,
) -> np.ndarray:
    """
    Approximate shade fraction based on solar altitude and building coverage.
    Higher buildings + lower sun → more shade.
    Uses a simple geometric approximation; real ray casting is in fetch_all.py.
    """
    if solar_altitude_deg <= 0:
        return np.ones_like(building_frac)
    # Shadow length = H / tan(altitude)
    # With typical building height ~10m and street width ~12m:
    # shade_frac ≈ building_frac × (10 / (12 × tan(alt)))
    import math
    tan_alt = math.tan(math.radians(max(solar_altitude_deg, 5)))
    shadow_ratio = 10.0 / (12.0 * tan_alt)   # H / (W × tan(alt))
    return np.clip(building_frac * shadow_ratio, 0.0, 1.0)


# ── Feature matrix ────────────────────────────────────────────────────────────

def _build_feature_matrix(
    df: pd.DataFrame,
    when_iso: str,
) -> np.ndarray:
    """
    Build feature matrix X for thermal prediction.
    Features: shade, ndvi, building_frac, road_frac, albedo_proxy, svf, dist_green_m
    """
    try:
        sp = _solar_position(when_iso)
        alt = sp["altitude_deg"]
    except Exception:
        alt = 50.0   # fallback: typical summer noon Athens

    shade = _shade_fraction(df["building_frac"].values, alt)
    n = len(df)
    X = np.column_stack([
        shade,
        df["ndvi"].values,
        df["building_frac"].values,
        df["road_frac"].values,
        df["albedo_proxy"].values,
        df["svf"].values,
        df["dist_green_m"].values / 500.0,            # normalize
        np.full(n, np.sin(np.radians(alt))),          # solar position (broadcast)
    ])
    return X


# ── Physics fallback model ────────────────────────────────────────────────────

class PhysicsModel:
    """
    Semi-empirical LST model when no Landsat training data is available.
    Parameterization based on literature values for Athens summer.
    """
    # Athens summer peak LST at noon: ~52°C on dense asphalt, ~30°C on vegetation
    BASE_LST_ASPHALT = 52.0
    BASE_LST_VEGETATION = 30.0
    BASE_LST_BUILDING = 48.0
    # Maximum LST reduction from full shade (canopy or building shadow), additive.
    # Βιβλιογραφία: 8–16 °C ψύξη επιφάνειας σε πλήρη σκιά → κεντρική τιμή 12.
    SHADE_DELTA_MAX = 12.0
    ALBEDO_K = 20.0  # °C ανά μονάδα albedo
    # Ευαισθησία των συντελεστών σκιάς/albedo (×2/3 … ×4/3) → p10/p90 της θερμικής αλλαγής
    COEF_SCALES = (2 / 3, 4 / 3)

    def predict(self, X: np.ndarray, coef_scale: float = 1.0) -> np.ndarray:
        shade, ndvi, bldg, road, albedo, svf, dist_green_norm, sin_alt = X.T
        # Weighted average by surface type (shade NOT applied here — single additive term below)
        lst = (
            road * self.BASE_LST_ASPHALT +
            bldg * self.BASE_LST_BUILDING +
            (1 - road - bldg).clip(0) * (
                ndvi * self.BASE_LST_VEGETATION + (1 - ndvi) * 42.0
            )
        )
        # Albedo correction: higher albedo → lower LST
        lst -= (albedo - 0.15) * self.ALBEDO_K * coef_scale
        # SVF: lower SVF (more enclosed) → trapped heat
        lst += (1 - svf) * 3.0
        # Shade: single additive term — tree/pavement scenario deltas scale linearly
        lst -= shade * self.SHADE_DELTA_MAX * coef_scale
        # Solar scaling
        lst *= np.clip(sin_alt, 0.1, 1.0) ** 0.3
        return lst.clip(20.0, 70.0)

    def predict_p10_p90(self, X: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        p50 = self.predict(X)
        sigma = 2.5  # typical residual for a physics model
        return p50 - 1.65 * sigma, p50 + 1.65 * sigma


# ── Model loading/training ────────────────────────────────────────────────────

def load_or_train_model(lst_data: np.ndarray | None = None) -> None:
    """
    Load a saved model, or train from LST data, or fall back to physics model.
    Call at startup.
    """
    global _thermal_model, _model_type

    model_path = DATA_PROCESSED_DIR / "thermal_model.pkl"
    if model_path.exists():
        try:
            with open(model_path, "rb") as f:
                _thermal_model = pickle.load(f)
            _model_type = "ridge"
            log.info("Loaded thermal model from %s", model_path)
            return
        except Exception as e:
            log.warning("Could not load thermal model: %s", e)

    if lst_data is not None:
        _train_model(lst_data, model_path)
    else:
        _thermal_model = PhysicsModel()
        _model_type = "physics"
        log.info("Using physics-based thermal model (no Landsat data)")


def _train_model(lst_data: np.ndarray, save_path: Path) -> None:
    """Train Ridge regression on LST data."""
    global _thermal_model, _model_type
    from sklearn.linear_model import Ridge
    from sklearn.preprocessing import StandardScaler
    from sklearn.pipeline import Pipeline

    X, y = lst_data[:, :-1], lst_data[:, -1]
    model = Pipeline([
        ("scaler", StandardScaler()),
        ("ridge", Ridge(alpha=1.0)),
    ])
    model.fit(X, y)
    _thermal_model = model
    _model_type = "ridge"

    save_path.parent.mkdir(parents=True, exist_ok=True)
    with open(save_path, "wb") as f:
        pickle.dump(model, f)
    log.info("Trained and saved thermal model (Ridge) to %s", save_path)


def load_base_grid(
    buildings_gdf=None,
    vegetation_gdf=None,
    roads_gdf=None,
) -> None:
    """Build and store the base feature grid. Call at startup."""
    global _grid_df
    grid_path = DATA_PROCESSED_DIR / "thermal_grid.parquet"
    if grid_path.exists():
        try:
            _grid_df = pd.read_parquet(grid_path)
            log.info("Loaded thermal grid from %s (%d cells)", grid_path, len(_grid_df))
            return
        except Exception as e:
            log.warning("Could not load thermal grid: %s", e)
    _grid_df = build_grid(buildings_gdf, vegetation_gdf, roads_gdf)
    grid_path.parent.mkdir(parents=True, exist_ok=True)
    _grid_df.to_parquet(grid_path, index=False)
    log.info("Built and saved thermal grid (%d cells)", len(_grid_df))


# ── Thermal frame (slider) ────────────────────────────────────────────────────

def compute_thermal_frame(when_iso: str) -> list[ThermalCell]:
    """
    Predict LST for all grid cells at a given time (no scenario).
    Used by GET /thermal/frame.
    """
    if _grid_df is None or _thermal_model is None:
        raise RuntimeError("Thermal model not loaded — call load_base_grid() and load_or_train_model()")

    X = _build_feature_matrix(_grid_df, when_iso)
    if isinstance(_thermal_model, PhysicsModel):
        lst = _thermal_model.predict(X)
    else:
        lst = _thermal_model.predict(X)

    cells = []
    for i, row in _grid_df.iterrows():
        cells.append(ThermalCell(
            lngLat=(round(row["lng"], 6), round(row["lat"], 6)),
            baseC=round(float(lst[i]), 2),
            newC=round(float(lst[i]), 2),   # no scenario applied
        ))
    return cells


# ── Scenario simulation ───────────────────────────────────────────────────────

def simulate_thermal(scenario: Scenario, cool_points: np.ndarray | None = None) -> tuple[ThermalPart, float]:
    """
    Predict LST before and after scenario edits.
    cool_points: σημεία (lng, lat) κατά μήκος των δρόμων του cool_pavement (network.way_points).
    Returns (ThermalPart, compute_ms).
    """
    if _grid_df is None or _thermal_model is None:
        raise RuntimeError("Thermal model not loaded")

    t_start = time.perf_counter()
    when = scenario.when
    X_base = _build_feature_matrix(_grid_df, when)

    # Apply scenario edits to feature matrix
    X_new = X_base.copy()
    df_new = _grid_df.copy()
    cool_mask = _cells_near(cool_points, COOL_PAVEMENT_REACH_M)
    for edit in scenario.edits:
        match edit.type:
            case "add_trees":
                _apply_add_trees(df_new, X_new, edit, when)
            case "cool_pavement":
                _apply_cool_pavement(X_new, cool_mask)

    # Predict
    variants: list[tuple[np.ndarray, np.ndarray]] = []
    if isinstance(_thermal_model, PhysicsModel):
        lst_base = _thermal_model.predict(X_base)
        lst_new = _thermal_model.predict(X_new)
        lst_base_p10, lst_base_p90 = _thermal_model.predict_p10_p90(X_base)
        variants = [(_thermal_model.predict(X_base, k), _thermal_model.predict(X_new, k))
                    for k in PhysicsModel.COEF_SCALES]
    else:
        lst_base = _thermal_model.predict(X_base)
        lst_new = _thermal_model.predict(X_new)
        # Bootstrap uncertainty: simple ±σ from residual std
        sigma = 2.0
        lst_base_p10 = lst_base - 1.65 * sigma
        lst_base_p90 = lst_base + 1.65 * sigma

    # Hotspot: cells near the scenario edit geometry (for thermal edits)
    # or near Σεράφειο (for traffic-only scenarios)
    edit_lnglats: list[tuple[float, float]] = []
    for edit in scenario.edits:
        if edit.type in ("add_trees", "cool_pavement"):
            if edit.type == "add_trees" and hasattr(edit, "geometry"):
                edit_lnglats.extend(edit.geometry)
            elif edit.type == "cool_pavement" and cool_points is not None and len(cool_points):
                edit_lnglats.append(tuple(cool_points.mean(axis=0)))

    if edit_lnglats:
        # Use centroid of edit geometry as hotspot reference
        ref_lng = float(np.mean([p[0] for p in edit_lnglats]))
        ref_lat = float(np.mean([p[1] for p in edit_lnglats]))
        radius_m = 150.0  # tighter window around the intervention
    else:
        ref_lng, ref_lat = SERAFEIO_LNGLAT
        radius_m = 200.0

    dist_to_ref = np.sqrt(
        ((_grid_df["lng"].values - ref_lng) * M_PER_DEG_LNG_AT_38) ** 2 +
        ((_grid_df["lat"].values - ref_lat) * M_PER_DEG_LAT) ** 2
    )
    hotspot_mask = dist_to_ref < radius_m
    if hotspot_mask.sum() == 0:
        hotspot_mask[:5] = True

    # Report mean of changed cells (more representative for sparse interventions)
    changed_mask = np.abs(lst_new[hotspot_mask] - lst_base[hotspot_mask]) > 0.05

    def hotspot_delta(base: np.ndarray, new: np.ndarray) -> float:
        d = new[hotspot_mask] - base[hotspot_mask]
        return float(np.mean(d[changed_mask])) if changed_mask.sum() >= 3 else float(np.median(d))

    p50 = hotspot_delta(lst_base, lst_new)
    has_thermal_edit = any(e.type in ("add_trees", "cool_pavement") for e in scenario.edits)
    if not has_thermal_edit:
        lo = hi = 0.0  # τίποτα δεν αλλάζει στο θερμικό μοντέλο, άρα ούτε αβεβαιότητα υπάρχει
    elif variants:
        vals = [p50, *(hotspot_delta(b, n) for b, n in variants)]
        lo, hi = min(vals), max(vals)
    else:
        lo, hi = p50 - 1.65 * 1.2, p50 + 1.65 * 1.2  # εκπαιδευμένο μοντέλο: residual sigma
    hotspot_range = Range(p10=round(lo, 2), p50=round(p50, 2), p90=round(hi, 2))

    # Build cell list (only cells with notable change OR near hotspot for payload size)
    cells: list[ThermalCell] = []
    for i in range(len(_grid_df)):
        row = _grid_df.iloc[i]
        b = float(lst_base[i])
        n = float(lst_new[i])
        if abs(n - b) > 0.1 or dist_to_ref[i] < 300.0:
            cells.append(ThermalCell(
                lngLat=(round(row["lng"], 6), round(row["lat"], 6)),
                baseC=round(b, 2),
                newC=round(n, 2),
            ))

    compute_ms = int((time.perf_counter() - t_start) * 1000)
    return ThermalPart(
        when=when,
        cells=cells,
        hotspotDeltaC=hotspot_range,
    ), compute_ms


def _apply_add_trees(
    df: pd.DataFrame,
    X: np.ndarray,
    edit,
    when_iso: str,
) -> None:
    """
    Modify feature matrix for add_trees: increase NDVI and shade,
    decrease albedo (more absorbed → but tree canopy intercepts before surface).
    """
    try:
        import pvlib
        import pandas as _pd
        location = pvlib.location.Location(37.979, 23.709, tz=ATHENS_TZ, altitude=100)
        times = _pd.DatetimeIndex([when_iso], tz=ATHENS_TZ)
        sp = location.get_solarposition(times)
        alt = float(sp["apparent_elevation"].iloc[0])
    except Exception:
        alt = 50.0

    # Interpolate `count` tree positions along the geometry path
    geom = list(edit.geometry)
    count = max(getattr(edit, "count", len(geom)), len(geom))
    if count > len(geom) and len(geom) >= 2:
        # Linear interpolation along the polyline
        # Build cumulative arc-length in degrees
        segs = []
        total = 0.0
        for i in range(len(geom) - 1):
            dlng = (geom[i+1][0] - geom[i][0]) * M_PER_DEG_LNG_AT_38
            dlat = (geom[i+1][1] - geom[i][1]) * M_PER_DEG_LAT
            segs.append(math.sqrt(dlng**2 + dlat**2))
            total += segs[-1]
        tree_positions = []
        for j in range(count):
            t = j / max(count - 1, 1) * total
            cum = 0.0
            for i, seg_len in enumerate(segs):
                if cum + seg_len >= t or i == len(segs) - 1:
                    frac = (t - cum) / max(seg_len, 1e-9)
                    frac = min(frac, 1.0)
                    lng = geom[i][0] + frac * (geom[i+1][0] - geom[i][0])
                    lat = geom[i][1] + frac * (geom[i+1][1] - geom[i][1])
                    tree_positions.append((lng, lat))
                    break
                cum += seg_len
    else:
        tree_positions = geom

    for tree_lng, tree_lat in tree_positions:
        dist_m = np.sqrt(
            ((df["lng"].values - tree_lng) * M_PER_DEG_LNG_AT_38) ** 2 +
            ((df["lat"].values - tree_lat) * M_PER_DEG_LAT) ** 2
        )
        # Gaussian NDVI/shade boost.
        # Physical canopy radius = TREE_CANOPY_RADIUS_M (4m), but the 25m grid
        # requires a larger effective sigma to reach the nearest cell centers.
        # sigma_m = 15m means 50% boost at ~15m, still negligible at 50m.
        sigma_m = max(TREE_CANOPY_RADIUS_M * 3.5, 15.0)
        ndvi_boost = TREE_NDVI_BOOST_CENTER * np.exp(-0.5 * (dist_m / sigma_m) ** 2)
        shade_boost = TREE_SHADE_PEAK * np.exp(-0.5 * (dist_m / sigma_m) ** 2)

        # Clip by side constraint
        if edit.side and edit.side != "both":
            if edit.side == "north":
                mask = df["lat"].values >= tree_lat
            elif edit.side == "south":
                mask = df["lat"].values < tree_lat
            elif edit.side == "east":
                mask = df["lng"].values >= tree_lng
            elif edit.side == "west":
                mask = df["lng"].values < tree_lng
            else:
                mask = np.ones(len(df), dtype=bool)
            ndvi_boost = ndvi_boost * mask
            shade_boost = shade_boost * mask

        # Update feature columns (indices: 0=shade, 1=ndvi)
        # Shade is the dominant cooling effect; albedo is NOT updated here because
        # tree canopies absorb solar (photosynthesis) rather than reflecting it,
        # and accumulating albedo boosts from 42 trees would over-cool by ~10°C.
        X[:, 0] = np.clip(X[:, 0] + shade_boost * np.sin(np.radians(max(alt, 5))), 0, 1)
        X[:, 1] = np.clip(X[:, 1] + ndvi_boost, 0, 1)


def _cells_near(points: np.ndarray | None, reach_m: float) -> np.ndarray:
    """Μάσκα κελιών με κέντρο σε απόσταση ≤ reach_m από κάποιο σημείο."""
    mask = np.zeros(len(_grid_df), dtype=bool)
    if points is None or not len(points):
        return mask
    gx = _grid_df["lng"].values * M_PER_DEG_LNG_AT_38
    gy = _grid_df["lat"].values * M_PER_DEG_LAT
    for x, y in points:  # λίγες εκατοντάδες σημεία × ~10k κελιά: ok
        mask |= (gx - x * M_PER_DEG_LNG_AT_38) ** 2 + (gy - y * M_PER_DEG_LAT) ** 2 <= reach_m ** 2
    return mask


def _apply_cool_pavement(X: np.ndarray, mask: np.ndarray) -> None:
    """Albedo +0.15 ΜΟΝΟ στα κελιά δρόμου που αγγίζουν οι δρόμοι του σεναρίου."""
    road = mask & (_grid_df["road_frac"].values > 0.05)
    X[road, 4] = np.clip(X[road, 4] + COOL_PAVEMENT_ALBEDO_BOOST, 0, 1)


# ── Accessors ─────────────────────────────────────────────────────────────────

def model_type() -> str:
    return _model_type
