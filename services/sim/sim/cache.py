"""
Result caching: in-memory LRU + disk persistence in demo/cache/.
Key = MD5(canonical JSON of Scenario).
"""
from __future__ import annotations
import hashlib
import json
from functools import lru_cache
from pathlib import Path
from .models import Scenario, SimResult
from .constants import DEMO_CACHE_DIR, SIM_MODEL_VERSION


def scenario_hash(scenario: Scenario) -> str:
    """Stable hash of a Scenario + model version (ignores `id`, only content matters)."""
    canonical = {
        "model": SIM_MODEL_VERSION,
        "edits": json.loads(scenario.model_dump_json())["edits"],
        "when": scenario.when,
    }
    blob = json.dumps(canonical, sort_keys=True, ensure_ascii=False).encode()
    return hashlib.md5(blob).hexdigest()[:16]


# In-process cache (survives request boundaries within one process lifetime)
_MEM_CACHE: dict[str, SimResult] = {}


def get_cached(h: str) -> SimResult | None:
    if h in _MEM_CACHE:
        return _MEM_CACHE[h]
    path = DEMO_CACHE_DIR / f"{h}.json"
    if path.exists():
        try:
            result = SimResult.model_validate_json(path.read_text(encoding="utf-8"))
            _MEM_CACHE[h] = result
            return result
        except Exception:
            pass
    return None


def put_cached(h: str, result: SimResult) -> None:
    _MEM_CACHE[h] = result
    DEMO_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path = DEMO_CACHE_DIR / f"{h}.json"
    path.write_text(result.model_dump_json(indent=2), encoding="utf-8")
