"""Έλεγχος λογικής του μοντέλου πάνω στα πραγματικά δεδομένα: `python check_model.py` (MOCK=0, ~1').

Αποτυγχάνει αν:
  - ένα σενάριο χωρίς κυκλοφοριακές αλλαγές δείξει αλλαγή κυκλοφορίας ≠ 0
  - ένα σενάριο χωρίς θερμικές αλλαγές δείξει θερμική αλλαγή ≠ 0
  - η λωρίδα λεωφορείου δεν αλλάξει τίποτα ή δώσει ίδιο αποτέλεσμα με το cool pavement
  - το εύρος δεν είναι p10 ≤ p50 ≤ p90
  - το cool pavement σε έναν δρόμο ψύξει κελιά μακριά από αυτόν
"""
from __future__ import annotations

import os
import sys
import time

os.environ["MOCK"] = "0"
sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[union-attr]

import main  # noqa: E402
from sim.models import Scenario  # noqa: E402

PIREOS = [652510532, 734712545, 217698400]
WHEN = "2026-07-15T13:00:00+03:00"
TREES = {"type": "add_trees", "geometry": [[23.7073, 37.9770], [23.7085, 37.9790], [23.7097, 37.9810]], "count": 42, "side": "south"}


def run(sid: str, edits: list[dict]):
    t = time.perf_counter()
    r = main._run_simulation(Scenario(id=sid, title=sid, edits=edits, when=WHEN, origin="user"))
    tt, hot = r.traffic.corridorTravelTimeDeltaPct, r.thermal.hotspotDeltaC
    print(f"{sid:16} {time.perf_counter() - t:5.1f}s  χρόνος {tt.p10:+6.2f} {tt.p50:+6.2f} {tt.p90:+6.2f}  "
          f"vkm {r.traffic.vehicleKmDeltaPct.p50:+5.2f}  co2 {r.emissions.co2DeltaPct.p50:+5.2f}  "
          f"θερμ {hot.p10:+5.2f} {hot.p50:+5.2f} {hot.p90:+5.2f}  segs {len(r.traffic.segments)} trips {len(r.traffic.trips)}")
    for rg in (tt, r.traffic.vehicleKmDeltaPct, r.emissions.co2DeltaPct, hot):
        assert rg.p10 <= rg.p50 <= rg.p90, (sid, rg)
    return r


main._load_all()
trees = run("trees-only", [TREES])
cool = run("cool-only", [{"type": "cool_pavement", "wayIds": PIREOS}])
bus = run("bus-lane", [{"type": "bus_lane", "wayIds": PIREOS}])
both = run("bus+trees", [{"type": "bus_lane", "wayIds": PIREOS}, TREES])
close = run("close-south", [{"type": "close_road", "wayIds": [217698402, 652510532]}])

zero = {"p10": 0.0, "p50": 0.0, "p90": 0.0}
assert trees.traffic.corridorTravelTimeDeltaPct.model_dump() == zero, "δέντρα άλλαξαν την κυκλοφορία"
assert cool.traffic.vehicleKmDeltaPct.model_dump() == zero, "cool pavement άλλαξε την κυκλοφορία"
assert bus.thermal.hotspotDeltaC.model_dump() == zero, "λωρίδα λεωφορείου άλλαξε το θερμικό"
assert bus.traffic.corridorTravelTimeDeltaPct.p50 > 0, "μία λωρίδα ΙΧ λιγότερη πρέπει να αυξάνει τον χρόνο ΙΧ"
assert bus.traffic.corridorTravelTimeDeltaPct != cool.traffic.corridorTravelTimeDeltaPct
assert both.traffic.corridorTravelTimeDeltaPct == bus.traffic.corridorTravelTimeDeltaPct, "τα δέντρα δεν αλλάζουν την κυκλοφορία"
assert close.traffic.vehicleKmDeltaPct.p50 > 0, "κλείσιμο δρόμου → παρακάμψεις → περισσότερα οχηματοχλμ"
cooled = [c for c in cool.thermal.cells if c.newC < c.baseC - 0.05]
assert cooled and max(abs(c.lngLat[1] - 37.977) for c in cooled) < 0.01, "cool pavement έξω από την Πειραιώς"
print("✓ όλοι οι έλεγχοι πέρασαν")
