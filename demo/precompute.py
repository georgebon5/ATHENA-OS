#!/usr/bin/env python3
"""
ATHENA-OS demo precompute — Dev 2 (Σωτήρης)
============================================
Τρέχει τα 8 πιθανότερα σενάρια του demo εκ των προτέρων και τα αποθηκεύει
στο demo/cache/<hash>.json ώστε:
  1. Ο director να τα φορτώσει άμεσα (fallback αν αργεί >8s)
  2. Η ATHENA να προτείνει παραλλαγές χωρίς καθυστέρηση

Χρήση:
  python demo/precompute.py              # τρέχει όλα τα σενάρια
  python demo/precompute.py --dry-run   # δείχνει ποια σενάρια χωρίς να τα τρέχει
  python demo/precompute.py --sim-url http://localhost:8100  # custom URL

Πρέπει να τρέξει ΜΕΤΑ το `python data/fetch_all.py` ή με MOCK=1.
"""
from __future__ import annotations
import argparse
import json
import os
import sys
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
# DEMO_CACHE_DIR env var matches Docker compose mount (./data:/data → /data/cache)
CACHE_DIR = Path(os.getenv("DEMO_CACHE_DIR", str(ROOT / "data" / "cache")))
CACHE_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_SIM_URL = "http://localhost:8100"

# ── Demo scenarios ─────────────────────────────────────────────────────────────
# Αντιστοιχούν στις πιθανές φωνητικές εντολές του κριτή στο SIMULATE beat.
# wayIds: mock IDs (αντικαθίστανται με πραγματικά OSM IDs μόλις τρέξει fetch_all.py)
# Για να βρεις τα πραγματικά IDs: GET /resolve?q=Πειραιώς → wayIds

PIREOS_WAY_IDS = [652510532, 734712545, 217698400]   # Πειραιώς κύριος άξονας (real OSM IDs)
PIREOS_SOUTH_WAYS = [217698402, 652510532]          # νότιο τμήμα (Thissio → Σεράφειο)

SCENARIOS = [
    # S1 — κύριο demo σενάριο (SIMULATE beat)
    {
        "id": "s-demo-main",
        "title": "Λωρίδα λεωφορείου + 42 δέντρα νότια πλευρά (κύριο σενάριο)",
        "edits": [
            {"type": "bus_lane", "wayIds": PIREOS_WAY_IDS},
            {"type": "add_trees", "geometry": [
                [23.7073, 37.9770], [23.7079, 37.9780], [23.7085, 37.9790],
                [23.7091, 37.9800], [23.7097, 37.9810], [23.7103, 37.9820],
            ], "count": 42, "side": "south"},
        ],
        "when": "2026-07-15T13:00:00+03:00",
        "origin": "user",
    },
    # S2 — παραλλαγή ATHENA: δέντρα βόρεια
    {
        "id": "s-variant-trees-north",
        "title": "Λωρίδα λεωφορείου + 42 δέντρα βόρεια πλευρά",
        "edits": [
            {"type": "bus_lane", "wayIds": PIREOS_WAY_IDS},
            {"type": "add_trees", "geometry": [
                [23.7073, 37.9770], [23.7085, 37.9790], [23.7097, 37.9810],
            ], "count": 42, "side": "north"},
        ],
        "when": "2026-07-15T13:00:00+03:00",
        "origin": "agent_variant",
        "parentId": "s-demo-main",
    },
    # S3 — παραλλαγή ATHENA: δέντρα και από τις δύο πλευρές (λιγότερα ανά πλευρά)
    {
        "id": "s-variant-trees-both",
        "title": "Λωρίδα λεωφορείου + 28 δέντρα αμφίπλευρα (καλύτερη παραλλαγή)",
        "edits": [
            {"type": "bus_lane", "wayIds": PIREOS_WAY_IDS},
            {"type": "add_trees", "geometry": [
                [23.7073, 37.9770], [23.7085, 37.9790], [23.7097, 37.9810],
            ], "count": 28, "side": "both"},
        ],
        "when": "2026-07-15T13:00:00+03:00",
        "origin": "agent_variant",
        "parentId": "s-demo-main",
    },
    # S4 — μόνο λωρίδα λεωφορείου (χωρίς δέντρα)
    {
        "id": "s-bus-lane-only",
        "title": "Μόνο λωρίδα λεωφορείου (χωρίς δέντρα)",
        "edits": [
            {"type": "bus_lane", "wayIds": PIREOS_WAY_IDS},
        ],
        "when": "2026-07-15T13:00:00+03:00",
        "origin": "agent_variant",
        "parentId": "s-demo-main",
    },
    # S5 — cool pavement (παραλλαγή μέτρου θερμικής άνεσης)
    {
        "id": "s-cool-pavement",
        "title": "Αντανακλαστικό οδόστρωμα (cool pavement) + δέντρα",
        "edits": [
            {"type": "cool_pavement", "wayIds": PIREOS_WAY_IDS},
            {"type": "add_trees", "geometry": [
                [23.7085, 37.9790], [23.7097, 37.9810],
            ], "count": 20, "side": "south"},
        ],
        "when": "2026-07-15T13:00:00+03:00",
        "origin": "agent_variant",
        "parentId": "s-demo-main",
    },
    # S6 — slider: καύσωνας Ιουλίου 14:00
    {
        "id": "s-heatwave-peak",
        "title": "Καύσωνας Ιουλίου 14:00 (slider)",
        "edits": [
            {"type": "bus_lane", "wayIds": PIREOS_WAY_IDS},
            {"type": "add_trees", "geometry": [
                [23.7073, 37.9770], [23.7085, 37.9790], [23.7097, 37.9810],
            ], "count": 42, "side": "south"},
        ],
        "when": "2026-07-15T14:00:00+03:00",
        "origin": "user",
    },
    # S7 — slider: πρωί (baseline χαμηλής θερμοκρασίας για σύγκριση)
    {
        "id": "s-morning-baseline",
        "title": "Πρωί 09:00 (slider baseline)",
        "edits": [
            {"type": "bus_lane", "wayIds": PIREOS_WAY_IDS},
            {"type": "add_trees", "geometry": [
                [23.7073, 37.9770], [23.7085, 37.9790], [23.7097, 37.9810],
            ], "count": 42, "side": "south"},
        ],
        "when": "2026-07-15T09:00:00+03:00",
        "origin": "user",
    },
    # S8 — κλείσιμο τμήματος (πεζοδρόμηση)
    {
        "id": "s-pedestrianize",
        "title": "Πεζοδρόμηση τμήματος Πειραιώς (νότιο)",
        "edits": [
            {"type": "close_road", "wayIds": PIREOS_SOUTH_WAYS},
            {"type": "add_trees", "geometry": [
                [23.7073, 37.9770], [23.7085, 37.9790],
            ], "count": 30, "side": "both"},
        ],
        "when": "2026-07-15T13:00:00+03:00",
        "origin": "agent_variant",
    },
]


def run_precompute(sim_url: str, dry_run: bool = False) -> None:
    if dry_run:
        print(f"\nDry run — {len(SCENARIOS)} scenarios would be computed:\n")
        for s in SCENARIOS:
            print(f"  [{s['id']}] {s['title']}")
        return

    print(f"\nPrecomputing {len(SCENARIOS)} scenarios against {sim_url}…\n")

    success, skipped, failed = 0, 0, 0

    for scenario_dict in SCENARIOS:
        sid = scenario_dict["id"]
        title = scenario_dict["title"]

        # Compute cache key (same logic as services/sim/sim/cache.py)
        import hashlib
        canonical = {
            "edits": scenario_dict["edits"],
            "when": scenario_dict["when"],
        }
        h = hashlib.md5(
            json.dumps(canonical, sort_keys=True, ensure_ascii=False).encode()
        ).hexdigest()[:16]

        cache_file = CACHE_DIR / f"{h}.json"
        if cache_file.exists():
            print(f"  SKIP  {sid} (cached as {h})")
            skipped += 1
            continue

        print(f"  RUN   {sid} … ", end="", flush=True)
        t0 = time.time()
        try:
            with httpx.Client(timeout=30) as client:
                r = client.post(f"{sim_url}/simulate", json=scenario_dict)
                r.raise_for_status()
                result = r.json()
                cache_file.write_text(json.dumps(result, indent=2, ensure_ascii=False))
                elapsed = time.time() - t0
                print(f"OK ({elapsed:.1f}s) → {h}")
                success += 1
        except Exception as e:
            elapsed = time.time() - t0
            print(f"FAIL ({elapsed:.1f}s): {e}")
            failed += 1

    print(f"\nDone: {success} computed, {skipped} skipped, {failed} failed.")
    print(f"Cache: {CACHE_DIR}")
    if failed > 0:
        print(f"\nWARNING: {failed} scenarios failed — demo fallbacks incomplete.")
        sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(description="ATHENA-OS demo precompute")
    parser.add_argument("--sim-url", default=DEFAULT_SIM_URL)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    # Health check
    if not args.dry_run:
        try:
            with httpx.Client(timeout=5) as c:
                r = c.get(f"{args.sim_url}/health")
                health = r.json()
                print(f"Sim service: status={health['status']}, mock={health['mock']}")
        except Exception as e:
            print(f"Cannot reach sim service at {args.sim_url}: {e}")
            print("Start the service first: uvicorn main:app --port 8100")
            sys.exit(1)

    run_precompute(args.sim_url, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
