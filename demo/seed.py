"""Φορτώνει ρεαλιστικές ιστορικές αναφορές στο bbox, ώστε η πόλη να μη φαίνεται άδεια.

    python demo/seed.py                 # μόνο αν δεν υπάρχουν ήδη
    python demo/seed.py --force         # ξαναγράφει τις ιστορικές (π.χ. μετά από νέες φωτογραφίες)

Οι αναφορές είναι στο packages/contracts/fixtures/reports_seed.json. Πραγματικές φωτογραφίες:
demo/seed/photos/<category>/*.jpg (π.χ. demo/seed/photos/pothole/1.jpg). Αλλιώς placeholder ανά κατηγορία.
Ο gateway κάνει seed και μόνος του στην πρώτη εκκίνηση (SEED_ON_START=1).
"""

import argparse
import json
import os
import urllib.request

ap = argparse.ArgumentParser()
ap.add_argument("--force", action="store_true")
ap.add_argument("--gateway", default=os.environ.get("GATEWAY_URL", "http://localhost:8000"))
args = ap.parse_args()

url = f"{args.gateway.rstrip('/')}/api/director/seed" + ("?force=true" if args.force else "")
with urllib.request.urlopen(urllib.request.Request(url, method="POST"), timeout=60) as r:
    out = json.load(r)
print(f"seeded: {out['seeded']} αναφορές" if out["seeded"] else "υπάρχουν ήδη (χρησιμοποίησε --force)")
