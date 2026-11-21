#!/usr/bin/env python3
"""
ATHENA-OS demo precompute — Dev 2 (Σωτήρης)
============================================
Τρέχει τα πιθανότερα σενάρια του demo (demo/scenarios.json) στον sim, που τα κρατά
στο cache του (data/cache/<hash>.json, το hash περιέχει την έκδοση του μοντέλου), ώστε
η ATHENA να φέρνει παραλλαγές χωρίς καθυστέρηση. Το `make demo` στέλνει τα ίδια σενάρια
και μέσω του gateway, άρα υπάρχουν και ως fallback αν πέσει ο sim.

Χρήση:
  python demo/precompute.py              # τρέχει όλα τα σενάρια
  python demo/precompute.py --dry-run   # δείχνει ποια σενάρια χωρίς να τα τρέχει
  python demo/precompute.py --sim-url http://localhost:8100  # custom URL

Πρέπει να τρέξει ΜΕΤΑ το `python data/fetch_all.py`, με τον sim σε MOCK=0.
"""
from __future__ import annotations
import argparse
import json
import sys
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
SCENARIOS = json.loads((ROOT / "demo" / "scenarios.json").read_text(encoding="utf-8"))

DEFAULT_SIM_URL = "http://localhost:8100"


def run_precompute(sim_url: str, dry_run: bool = False) -> None:
    if dry_run:
        print(f"Dry run — {len(SCENARIOS)} scenarios would be computed:")
        for s in SCENARIOS:
            print(f"  [{s['id']}] {s['title']}")
        return

    print(f"Precomputing {len(SCENARIOS)} scenarios against {sim_url}…")
    failed = 0
    with httpx.Client(timeout=60) as client:
        for scenario in SCENARIOS:
            print(f"  RUN   {scenario['id']} … ", end="", flush=True)
            t0 = time.time()
            try:
                r = client.post(f"{sim_url}/simulate", json=scenario)
                r.raise_for_status()
                tt = r.json()["traffic"]["corridorTravelTimeDeltaPct"]["p50"]
                print(f"OK ({time.time() - t0:.1f}s, χρόνος {tt:+.2f}%)")
            except Exception as e:  # noqa: BLE001
                print(f"FAIL ({time.time() - t0:.1f}s): {e}")
                failed += 1
    print(f"Done: {len(SCENARIOS) - failed} ok, {failed} failed.")
    if failed:
        sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(description="ATHENA-OS demo precompute")
    parser.add_argument("--sim-url", default=DEFAULT_SIM_URL)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not args.dry_run:
        try:
            with httpx.Client(timeout=5) as c:
                health = c.get(f"{args.sim_url}/health").json()
        except Exception as e:  # noqa: BLE001
            print(f"Cannot reach sim service at {args.sim_url}: {e}")
            print("Start the service first: uvicorn main:app --port 8100")
            sys.exit(1)
        print(f"Sim service: status={health['status']}, mock={health['mock']}")
        if health["mock"]:
            print("Ο sim τρέχει με MOCK=1: τα αποτελέσματα θα ήταν fixtures, όχι προσομοίωση. Τρέξε τον με MOCK=0.")
            sys.exit(1)

    run_precompute(args.sim_url, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
