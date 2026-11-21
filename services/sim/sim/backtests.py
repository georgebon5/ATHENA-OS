"""
Backtest computation and storage.

Traffic backtest:
  - Calibrate OD matrix on most weekdays → evaluate on a held-out day
  - Metric: MAPE of edge flows at sensor locations

Thermal backtest:
  - Spatial cross-validation on Landsat scene(s)
  - Metric: MAE (°C) and R² between predicted and observed LST

If real data is not yet available, returns honest mock backtests with
documented assumptions so we can defend the numbers.
"""
from __future__ import annotations
import json
import logging
from pathlib import Path

from .models import Backtest, ChartPoint
from .constants import DATA_PROCESSED_DIR

log = logging.getLogger(__name__)


def load_backtests() -> list[Backtest]:
    """
    Load pre-computed backtests from disk, or return documented mock values.
    """
    cache_path = DATA_PROCESSED_DIR / "backtests.json"
    if cache_path.exists():
        try:
            data = json.loads(cache_path.read_text(encoding="utf-8"))
            backtests = [Backtest.model_validate(b) for b in data]
            log.info("Loaded %d backtests from %s", len(backtests), cache_path)
            return backtests
        except Exception as e:
            log.warning("Could not load backtests: %s — using mock values", e)
    return _mock_backtests()


def save_backtests(backtests: list[Backtest]) -> None:
    cache_path = DATA_PROCESSED_DIR / "backtests.json"
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(
        json.dumps([b.model_dump() for b in backtests], indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    log.info("Saved %d backtests to %s", len(backtests), cache_path)


def run_traffic_backtest(
    G,              # nx.MultiDiGraph
    held_out_flows: dict,   # {sensor_id: observed_flow}
    od_matrix: dict,
) -> Backtest:
    """
    Evaluate the traffic model against sensor observations.
    held_out_flows: {edge_key: observed_flow_veh_h}
    """
    from .traffic import frank_wolfe, _build_od_matrix
    import numpy as np

    predicted_flows, _ = frank_wolfe(G, od_matrix, n_iter=50)

    obs_vals, pred_vals = [], []
    for key, obs in held_out_flows.items():
        pred = predicted_flows.get(key, 0.0)
        obs_vals.append(obs)
        pred_vals.append(pred)

    obs_arr = np.array(obs_vals, dtype=float)
    pred_arr = np.array(pred_vals, dtype=float)

    mape = float(np.mean(np.abs((obs_arr - pred_arr) / np.maximum(obs_arr, 1.0))) * 100)

    chart = [
        ChartPoint(predicted=round(float(p), 1), observed=round(float(o), 1))
        for p, o in zip(pred_arr, obs_arr)
    ]
    return Backtest(
        model="traffic",
        metric="MAPE",
        value=round(mape, 2),
        heldOut="held-out day (see backtests.json for details)",
        nSamples=len(obs_vals),
        chart=chart,
    )


def run_thermal_backtest(
    X_test: "np.ndarray",
    y_test: "np.ndarray",
    model,
    held_out_label: str,
) -> list[Backtest]:
    """
    Evaluate the thermal model on a held-out Landsat scene.
    Uses spatial cross-validation (blocked by 200 m tiles) to avoid
    information leakage between adjacent pixels.
    """
    import numpy as np
    from sklearn.metrics import r2_score

    y_pred = model.predict(X_test)
    mae = float(np.mean(np.abs(y_pred - y_test)))
    r2 = float(r2_score(y_test, y_pred))

    chart = [
        ChartPoint(predicted=round(float(p), 2), observed=round(float(o), 2))
        for p, o in zip(y_pred, y_test)
    ]

    return [
        Backtest(
            model="thermal",
            metric="MAE_C",
            value=round(mae, 3),
            heldOut=held_out_label,
            nSamples=len(y_test),
            chart=chart,
        ),
        Backtest(
            model="thermal",
            metric="R2",
            value=round(r2, 4),
            heldOut=held_out_label,
            nSamples=len(y_test),
            chart=chart,
        ),
    ]


def _mock_backtests() -> list[Backtest]:
    """
    Honest mock values for pre-data phase.
    These are realistic expectations for our model setup:
    - Traffic MAPE ~16%: typical for synthetic OD without real sensor calibration.
      With calibrated OD (once sensors are found), expect 8-12%.
    - Thermal MAE ~1.9°C: typical for ridge regression on urban LST with
      limited features. With NDVI from Sentinel-2 and proper shade, expect 1.2-1.5°C.
    - R² ~0.70: good for urban LST prediction without wall/roof temperature data.
    """
    import random
    rng = random.Random(99)

    traffic_chart: list[ChartPoint] = []
    for obs in range(200, 1600, 70):
        noise = rng.gauss(0, obs * 0.16)
        traffic_chart.append(ChartPoint(predicted=round(obs + noise, 1), observed=float(obs)))

    thermal_chart: list[ChartPoint] = []
    for obs_lst in range(28, 60, 2):
        noise = rng.gauss(0, 1.9)
        thermal_chart.append(ChartPoint(predicted=round(obs_lst + noise, 2), observed=float(obs_lst)))

    return [
        Backtest(
            model="traffic",
            metric="MAPE",
            value=16.3,
            heldOut="MOCK — θα αντικατασταθεί με πραγματικούς αισθητήρες (data.gov.gr)",
            nSamples=len(traffic_chart),
            chart=traffic_chart,
        ),
        Backtest(
            model="thermal",
            metric="MAE_C",
            value=1.87,
            heldOut="MOCK — θα αντικατασταθεί με Landsat 9 (καλοκαίρι 2024/2025)",
            nSamples=len(thermal_chart),
            chart=thermal_chart,
        ),
        Backtest(
            model="thermal",
            metric="R2",
            value=0.71,
            heldOut="MOCK — θα αντικατασταθεί με Landsat 9 (καλοκαίρι 2024/2025)",
            nSamples=len(thermal_chart),
            chart=thermal_chart,
        ),
    ]
