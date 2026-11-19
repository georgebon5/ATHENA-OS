"""Παράγει τα fixtures/*.json (τα mocks όλων) με σταθερό seed.

    uv run --no-project python packages/contracts/scripts/make_fixtures.py

Τα αρχεία γίνονται commit. Αν τα αλλάξεις με το χέρι, μην ξανατρέξεις αυτό το script.
"""

from __future__ import annotations

import json
import math
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "fixtures"
rng = random.Random(2026_11_21)

SERAFIO = (23.7108, 37.9787)  # Πειραιώς 144
BBOX = (23.700, 37.970, 23.730, 37.990)
# Η Πειραιώς γύρω από το Σεράφειο (ΝΔ → ΒΑ)
PIRAIOS = [
    (23.7050, 37.9740),
    (23.7065, 37.9755),
    (23.7080, 37.9770),
    (23.7108, 37.9787),
    (23.7130, 37.9800),
    (23.7155, 37.9815),
]
# Πραγματικά OSM way ids της Πειραιώς (ίδια με demo/precompute.py του sim), για να τρέχουν και στον live sim
PIRAIOS_WAY_IDS = [652510532, 734712545, 217698400]

NOW = datetime(2026, 11, 21, 10, 0, tzinfo=timezone.utc)
JULY = "2026-07-15T14:00:00+03:00"

PHOTO = "https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=1200&q=70"
AFTER = "https://images.unsplash.com/photo-1507149833265-60c372daea22?auto=format&fit=crop&w=1200&q=70"

DEPARTMENTS = {
    "pothole": "Διεύθυνση Οδοποιίας",
    "sidewalk_damage": "Διεύθυνση Οδοποιίας",
    "waste": "Διεύθυνση Καθαριότητας & Ανακύκλωσης",
    "lighting": "Τμήμα Ηλεκτροφωτισμού",
    "obstruction": "Δημοτική Αστυνομία",
    "heat_exposure": "Διεύθυνση Πρασίνου & Αστικής Πανίδας",
    "graffiti": "Διεύθυνση Καθαριότητας & Ανακύκλωσης",
    "accessibility": "Γραφείο Προσβασιμότητας",
    "other": "Κέντρο Εξυπηρέτησης Πολιτών",
}
SUMMARIES = {
    "pothole": ["Λακκούβα στο οδόστρωμα, κίνδυνος για δικυκλιστές.", "Βαθιά λακκούβα κοντά σε διάβαση πεζών."],
    "sidewalk_damage": ["Σπασμένες πλάκες στο πεζοδρόμιο.", "Ανασηκωμένο πεζοδρόμιο από ρίζες δέντρου."],
    "waste": ["Υπερχειλισμένοι κάδοι απορριμμάτων.", "Ογκώδη αντικείμενα εγκαταλελειμμένα στο πεζοδρόμιο."],
    "lighting": ["Σβηστός φανοστάτης σε σκοτεινό σημείο.", "Ο φωτισμός αναβοσβήνει όλη τη νύχτα."],
    "obstruction": ["Σταθμευμένο όχημα κλείνει τη ράμπα.", "Εργοταξιακά υλικά στο πεζοδρόμιο."],
    "heat_exposure": ["Πεζοδρόμιο χωρίς σκιά, υψηλή έκθεση στον ήλιο.", "Στάση λεωφορείου χωρίς στέγαστρο και σκιά."],
    "graffiti": ["Συνθήματα σε πρόσοψη διατηρητέου.", "Graffiti σε στάση λεωφορείου."],
    "accessibility": ["Ράμπα ΑμεΑ με απότομη κλίση.", "Λείπει ο οδηγός τυφλών στη διάβαση."],
    "other": ["Σπασμένη πινακίδα σήμανσης.", "Διαρροή νερού στο πεζοδρόμιο."],
}
WEIGHTS = {
    "pothole": 6, "sidewalk_damage": 7, "waste": 6, "lighting": 3, "obstruction": 5,
    "heat_exposure": 5, "graffiti": 3, "accessibility": 4, "other": 2,
}


def r(x: float, n: int = 6) -> float:
    return round(x, n)


def iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def near_piraios() -> tuple[float, float]:
    """Σημείο κοντά στην Πειραιώς (οι αναφορές μαζεύονται στους δρόμους, όχι ομοιόμορφα)."""
    if rng.random() < 0.55:
        i = rng.randrange(len(PIRAIOS) - 1)
        t = rng.random()
        (a, b), (c, d) = PIRAIOS[i], PIRAIOS[i + 1]
        return (a + (c - a) * t + rng.gauss(0, 0.0004), b + (d - b) * t + rng.gauss(0, 0.0004))
    return (rng.uniform(BBOX[0] + 0.002, BBOX[2] - 0.002), rng.uniform(BBOX[1] + 0.002, BBOX[3] - 0.002))


def classification(cat: str, severity: int | None = None, duplicates: list[str] | None = None) -> dict:
    return {
        "category": cat,
        "severity": severity or rng.choice([1, 2, 2, 3, 3, 3, 4, 4, 5]),
        "summaryEl": rng.choice(SUMMARIES[cat]),
        "department": DEPARTMENTS[cat],
        "duplicates": duplicates or [],
        "confidence": r(rng.uniform(0.72, 0.97), 2),
    }


def reports_seed(n: int = 40) -> list[dict]:
    cats = list(WEIGHTS)
    out = []
    for i in range(n):
        cat = rng.choices(cats, weights=[WEIGHTS[c] for c in cats])[0]
        lng, lat = near_piraios()
        rid = f"r-seed-{i + 1:03d}"
        out.append({
            "id": rid,
            "createdAt": iso(NOW - timedelta(days=rng.uniform(0.2, 30))),
            "photoUrl": f"/media/seed/{rid}.jpg",
            "location": [r(lng), r(lat)],
            "heading": r(rng.uniform(0, 360), 1),
            "accuracyM": r(rng.uniform(4, 18), 1),
            "classification": classification(cat),
        })
    out.sort(key=lambda x: x["createdAt"])
    return out


def segments(scale: float) -> list[dict]:
    segs = []
    for i in range(len(PIRAIOS) - 1):
        base_flow = rng.uniform(1050, 1350)
        base_t = rng.uniform(55, 75)
        segs.append({
            "wayId": 10000 + i,
            "baseFlow": r(base_flow, 0),
            "newFlow": r(base_flow * (1 - 0.12 * scale + rng.uniform(-0.02, 0.02)), 0),
            "baseTimeS": r(base_t, 1),
            "newTimeS": r(base_t * (1 - 0.09 * scale + rng.uniform(-0.015, 0.015)), 1),
            "path": [[a, b] for a, b in PIRAIOS[i : i + 2]],
        })
    return segs


def trips(n: int) -> list[dict]:
    out = []
    for _ in range(n):
        dx, dy = rng.gauss(0, 0.00015), rng.gauss(0, 0.00015)
        path = [[r(a + dx), r(b + dy)] for a, b in PIRAIOS]
        if rng.random() < 0.5:
            path.reverse()
        out.append({"path": path, "departS": r(rng.uniform(0, 120), 1), "durationS": r(rng.uniform(70, 140), 1)})
    return out


def cells(delta_c: float) -> list[dict]:
    """Πλέγμα ~25 m γύρω από το Σεράφειο, με hotspot πάνω στην Πειραιώς."""
    out = []
    step_lng, step_lat = 0.000285, 0.000225  # ~25 m
    for i in range(-10, 11):
        for j in range(-10, 11):
            lng = SERAFIO[0] + i * step_lng
            lat = SERAFIO[1] + j * step_lat
            # απόσταση από τη γραμμή της Πειραιώς (σε «κελιά»)
            d = abs((lat - SERAFIO[1]) / step_lat - 0.75 * (lng - SERAFIO[0]) / step_lng) / 1.25
            base = 34.5 + 6.0 * math.exp(-d / 3.0) + rng.gauss(0, 0.35)
            effect = delta_c * math.exp(-d / 2.5)
            out.append({"lngLat": [r(lng), r(lat)], "baseC": r(base, 2), "newC": r(base + effect + rng.gauss(0, 0.08), 2)})
    return out


def rng_range(p50: float, spread_lo: float, spread_hi: float) -> dict:
    return {"p10": r(p50 - spread_lo, 2), "p50": r(p50, 2), "p90": r(p50 + spread_hi, 2)}


def sim_result(scenario_id: str, scale: float, delta_c: float, compute_ms: int) -> dict:
    return {
        "scenarioId": scenario_id,
        "status": "ok",
        "computeMs": compute_ms,
        "traffic": {
            "segments": segments(scale),
            "corridorTravelTimeDeltaPct": rng_range(-3.8 * scale, 2.7, 2.7),
            "vehicleKmDeltaPct": rng_range(-2.4 * scale, 2.7, 2.7),
            "trips": trips(300),
        },
        "thermal": {"when": JULY, "cells": cells(delta_c), "hotspotDeltaC": rng_range(delta_c, 0.9, 1.3)},
        "emissions": {"co2DeltaPct": rng_range(-2.1 * scale, 2.7, 2.3)},
        "notes": [
            "MOCK: δεδομένα από packages/contracts/fixtures — όχι πραγματική προσομοίωση",
            "Κυκλοφορία: ζήτηση ΟΑΣΑ/ΥΠΟΜΕ Πέμπτη 08:00–10:00, ανάθεση user-equilibrium",
            "Θερμικό: πλέγμα 25 m, βάση Landsat 14/07/2025",
            f"Παραδοχή: κάλυψη κόμης δέντρων +{round(18 * scale)}% σε 10 χρόνια",
        ],
    }


def backtests() -> list[dict]:
    traffic_chart = []
    for _ in range(96):
        obs = rng.uniform(280, 1250)
        traffic_chart.append({"predicted": r(obs * (1 + rng.gauss(0, 0.12)), 1), "observed": r(obs, 1)})
    thermal_chart = []
    for _ in range(140):
        obs = rng.uniform(29, 45)
        thermal_chart.append({"predicted": r(obs + rng.gauss(0, 0.9), 2), "observed": r(obs, 2)})
    mape = sum(abs(p["predicted"] - p["observed"]) / p["observed"] for p in traffic_chart) / len(traffic_chart) * 100
    mae = sum(abs(p["predicted"] - p["observed"]) for p in thermal_chart) / len(thermal_chart)
    return [
        {"model": "traffic", "metric": "MAPE", "value": r(mape, 1), "heldOut": "Τρίτη 17/11/2026, 07:00–10:00",
         "nSamples": len(traffic_chart), "chart": traffic_chart},
        {"model": "thermal", "metric": "MAE_C", "value": r(mae, 2), "heldOut": "Landsat 14/07/2025",
         "nSamples": len(thermal_chart), "chart": thermal_chart},
    ]


def buses() -> list[dict]:
    lines = ["049", "914", "838", "Β18", "Γ18", "815", "856"]
    out = []
    for i, line in enumerate(lines):
        k = rng.randrange(len(PIRAIOS) - 1)
        t = rng.random()
        (a, b), (c, d) = PIRAIOS[k], PIRAIOS[k + 1]
        forward = rng.random() < 0.5
        out.append({
            "id": str(31000 + rng.randrange(2000)),
            "line": line,
            "lngLat": [r(a + (c - a) * t), r(b + (d - b) * t)],
            "bearing": 52.0 if forward else 232.0,
        })
    return out


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    seed = reports_seed()

    report = {
        "id": "r-demo-001",
        "createdAt": iso(NOW),
        "photoUrl": PHOTO,
        "location": [23.7111, 37.9789],
        "heading": 48.0,
        "accuracyM": 6.0,
    }
    cls = {
        "category": "heat_exposure",
        "severity": 4,
        "summaryEl": "Πεζοδρόμιο της Πειραιώς χωρίς σκιά, με υψηλή έκθεση στον ήλιο τις μεσημεριανές ώρες.",
        "department": DEPARTMENTS["heat_exposure"],
        "duplicates": [x["id"] for x in seed if x["classification"]["category"] == "heat_exposure"][:1],
        "confidence": 0.86,
    }
    scenario = {
        "id": "s-demo-001",
        "title": "Δέντρα και λωρίδα λεωφορείου στην Πειραιώς",
        "edits": [
            {"type": "add_trees", "geometry": [list(p) for p in PIRAIOS], "count": 42, "side": "south"},
            {"type": "bus_lane", "wayIds": PIRAIOS_WAY_IDS},
        ],
        "when": iso(NOW),
        "origin": "user",
    }
    variant = {
        "id": "s-demo-001-v2",
        "title": "Δέντρα και στις δύο πλευρές, ψυχρό οδόστρωμα και λωρίδα λεωφορείου",
        "edits": [
            {"type": "add_trees", "geometry": [list(p) for p in PIRAIOS], "count": 64, "side": "both"},
            {"type": "cool_pavement", "wayIds": PIRAIOS_WAY_IDS[1:]},
            {"type": "bus_lane", "wayIds": PIRAIOS_WAY_IDS},
        ],
        "when": iso(NOW),
        "origin": "agent_variant",
        "parentId": "s-demo-001",
    }
    consultation = {
        "id": "c-demo-001",
        "scenarioId": variant["id"],
        "reportId": report["id"],
        "beforeUrl": PHOTO,
        "afterUrl": AFTER,
        "questionEl": "Συμφωνείτε να φυτευτούν 64 δέντρα και να γίνει λωρίδα λεωφορείου στην Πειραιώς, μπροστά στο Σεράφειο;",
        "publicUrl": "http://localhost:8000/c/v/c-demo-001",
    }
    neighborhoods = [(23.7125, 37.9785), (23.7180, 37.9780), (23.7205, 37.9765), (23.7100, 37.9700), (23.7200, 37.9840)]
    points = []
    yes = no = maybe = 0
    for _ in range(37):
        choice = rng.choices(["yes", "no", "maybe"], weights=[62, 21, 17])[0]
        yes, no, maybe = yes + (choice == "yes"), no + (choice == "no"), maybe + (choice == "maybe")
        if rng.random() < 0.7:
            lng, lat = rng.choice(neighborhoods)
            points.append({"lngLat": [r(lng + rng.gauss(0, 0.0007)), r(lat + rng.gauss(0, 0.0006))], "choice": choice})
    tally = {"consultationId": consultation["id"], "yes": yes, "no": no, "maybe": maybe, "points": points}

    sim = sim_result(scenario["id"], 1.0, -2.2, 2140)
    sim_v = sim_result(variant["id"], 1.6, -3.4, 2380)
    decision = {
        "scenarioId": variant["id"],
        "markdownEl": (
            "# ΣΧΕΔΙΟ ΑΠΟΦΑΣΗΣ\n\n"
            "## ΘΕΜΑ\nΔιαμόρφωση της οδού Πειραιώς στο ύψος του Σεραφείου με φύτευση δέντρων, ψυχρό οδόστρωμα "
            "και αποκλειστική λωρίδα λεωφορείου.\n\n"
            "## ΣΚΕΠΤΙΚΟ\nΗ προσομοίωση εκτιμά μεταβολή χρόνου διαδρομής του άξονα "
            f"{sim_v['traffic']['corridorTravelTimeDeltaPct']['p50']}% "
            f"(εύρος {sim_v['traffic']['corridorTravelTimeDeltaPct']['p10']}% έως "
            f"{sim_v['traffic']['corridorTravelTimeDeltaPct']['p90']}%) και μεταβολή θερμοκρασίας στο hotspot "
            f"{sim_v['thermal']['hotspotDeltaC']['p50']}°C (εύρος {sim_v['thermal']['hotspotDeltaC']['p10']} έως "
            f"{sim_v['thermal']['hotspotDeltaC']['p90']}°C) [1][2].\n\n"
            "## ΔΕΔΟΜΕΝΑ\n- Αναφορές πολιτών μέσω ATHENA Sense [3]\n- Backtesting κυκλοφορίας και θερμικού [4]\n\n"
            f"## ΔΙΑΒΟΥΛΕΥΣΗ\n{yes + no + maybe} συμμετοχές: {yes} Ναι, {no} Όχι, {maybe} Ίσως [5].\n\n"
            "## ΑΠΟΦΑΣΙΖΕΙ\nΕισηγείται πιλοτική εφαρμογή 3 μηνών σε μία γειτονιά, με επαναμέτρηση μετά το πέρας της."
        ),
        "citations": [
            {"label": "[1] Προσομοίωση κυκλοφορίας", "source": f"ATHENA sim · {variant['id']} · traffic"},
            {"label": "[2] Θερμικό μοντέλο", "source": "Landsat 14/07/2025 · πλέγμα 25 m"},
            {"label": "[3] Αναφορές πολιτών", "source": "ATHENA Sense · Νοέμβριος 2026"},
            {"label": "[4] Backtesting", "source": "Τρίτη 17/11/2026, 07:00–10:00"},
            {"label": "[5] Διαβούλευση", "source": f"ATHENA Engage · {consultation['id']}"},
        ],
    }
    by_cat: dict[str, int] = {}
    for x in seed:
        by_cat[x["classification"]["category"]] = by_cat.get(x["classification"]["category"], 0) + 1
    city = {
        "updatedAt": iso(NOW),
        "buses": {"active": 7, "lines": ["049", "815", "838", "856", "914", "Β18", "Γ18"], "source": "mock"},
        "weather": {"temperatureC": 17.4, "apparentC": 16.1, "source": "open-meteo"},
        "reports": {"total": len(seed), "last24h": 3, "byCategory": dict(sorted(by_cat.items()))},
    }

    files = {
        "report.json": ("Report", report),
        "report_classified.json": ("Report", {**report, "classification": cls}),
        "classification.json": ("ReportClassification", cls),
        "reports_seed.json": ("Report[]", seed),
        "scenario.json": ("Scenario", scenario),
        "scenario_variant.json": ("Scenario", variant),
        "sim_result.json": ("SimResult", sim),
        "sim_result_variant.json": ("SimResult", sim_v),
        "backtests.json": ("Backtest[]", backtests()),
        "consultation.json": ("Consultation", consultation),
        "vote_tally.json": ("VoteTally", tally),
        "decision.json": ("DecisionDraft", decision),
        "buses.json": ("Bus[]", buses()),
        "city_live.json": ("CityLive", city),
    }
    manifest = {}
    for name, (type_name, data) in files.items():
        manifest[name] = type_name
        (OUT / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {len(files)} fixtures -> {OUT}")


if __name__ == "__main__":
    main()
