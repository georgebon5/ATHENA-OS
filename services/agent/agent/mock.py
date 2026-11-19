"""
MOCK=1 mode: canned event sequences που οδηγούν το demo.
Χρησιμοποιούνται και για το fallback όταν ο agent loop αργεί.
"""
from __future__ import annotations
import json
from pathlib import Path
from .constants import CAMERA_SHOTS, SERAFIO_LNGLAT, FIXTURES_DIR

# ── Helpers ────────────────────────────────────────────────────────────────

def _load(name: str) -> dict:
    p = FIXTURES_DIR / name
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"))
    return {}


def _say(text: str, mood: str = "neutral") -> tuple[str, dict]:
    return "agent.say", {"textEl": text, "mood": mood}


def _think(step: str) -> tuple[str, dict]:
    return "agent.thinking", {"stepEl": step}


def _fly(shot: str) -> tuple[str, dict]:
    return "camera.flyTo", CAMERA_SHOTS.get(shot, CAMERA_SHOTS["orbitSerafio"])


def _layer(layer: str, visible: bool) -> tuple[str, dict]:
    return "layer.set", {"layer": layer, "visible": visible}


def _time(when: str) -> tuple[str, dict]:
    return "time.set", {"when": when}


# ── /intro ─────────────────────────────────────────────────────────────────

def intro_sequence(city_live: dict) -> list[tuple[str, dict]]:
    buses = city_live.get("buses", {})
    weather = city_live.get("weather", {})
    reports = city_live.get("reports", {})

    n_buses   = buses.get("active", 7)
    temp      = weather.get("temperatureC", 17)
    n_reports = reports.get("last24h", 3)

    return [
        _fly("riseToOverview"),
        _layer("buses", True),
        ("time.set", {"when": "2026-11-21T10:00:00+02:00"}),
        _say(
            f"Γεια σας. Είμαι η ΑΘΗΝΑ — το λειτουργικό σύστημα αυτής της πόλης. "
            f"Αυτή τη στιγμή μέσα μου κυκλοφορούν {n_buses} γραμμές λεωφορείων, "
            f"έχω {n_reports} νέες αναφορές από πολίτες τις τελευταίες 24 ώρες, "
            f"και η θερμοκρασία είναι {temp} βαθμοί.",
            mood="neutral",
        ),
        _fly("orbitSerafio"),
        _layer("thermal", True),
        _say(
            "Αυτό εδώ είναι το Σεράφειο. Είναι ένα από τα πιο θερμά σημεία μου το καλοκαίρι. "
            "Πείτε μου τι θέλετε να αλλάξουμε.",
            mood="alert",
        ),
    ]


# ── /classify ──────────────────────────────────────────────────────────────

def mock_classification(report_id: str) -> dict:
    base = _load("report_classified.json")
    cls = base.get("classification", {})
    return {
        "category": cls.get("category", "heat_exposure"),
        "severity": cls.get("severity", 4),
        "summaryEl": cls.get("summaryEl", "Πεζοδρόμιο χωρίς σκιά, υψηλή έκθεση στον ήλιο."),
        "department": cls.get("department", "Διεύθυνση Πρασίνου & Αστικής Πανίδας"),
        "duplicates": [],
        "confidence": 0.84,
    }


def classify_say_sequence(classification: dict, is_hotspot: bool = True) -> list[tuple[str, dict]]:
    cat = classification.get("category", "other")
    sev = classification.get("severity", 3)
    summary = classification.get("summaryEl", "")

    events = [
        _think("Αναλύω τη φωτογραφία…"),
        _think(f"Κατηγορία: {cat}, σοβαρότητα: {sev}/5"),
        ("report.classified", {}),  # payload θα συμπληρωθεί από το caller
        _say(f"Η φωτογραφία δείχνει: {summary}", mood="neutral"),
    ]

    if is_hotspot or cat == "heat_exposure":
        events += [
            _think("Ελέγχω αν είναι hotspot στο θερμικό μοντέλο…"),
            _layer("thermal", True),
            _fly("streetLevel"),
            _say(
                "Αυτό το σημείο είναι από τα πιο ζεστά μου το καλοκαίρι. "
                "Θέλετε να δοκιμάσουμε κάτι για να το δροσίσουμε;",
                mood="alert",
            ),
        ]

    return events


# ── /command — γνωστά σενάρια demo ────────────────────────────────────────

PIREOS_WAY_IDS = [652510532, 217698400, 217698402]

def _scenario_payload(title: str, edits: list, when: str = "2026-07-15T13:00:00+03:00") -> dict:
    import uuid
    return {
        "id": f"s-{uuid.uuid4().hex[:8]}",
        "title": title,
        "edits": edits,
        "when": when,
        "origin": "user",
    }


def _variant_payload(title: str, edits: list, parent_id: str, when: str = "2026-07-15T13:00:00+03:00") -> dict:
    import uuid
    return {
        "id": f"v-{uuid.uuid4().hex[:8]}",
        "title": title,
        "edits": edits,
        "when": when,
        "origin": "agent_variant",
        "parentId": parent_id,
    }


def simulate_sequence(title: str, edits: list, sim_result: dict, variant_result: dict | None = None) -> list[tuple[str, dict]]:
    """Ακολουθία events για ένα simulate beat (με optional variant compare)."""
    scenario_id = sim_result.get("scenarioId", "s-demo")
    corridor = sim_result.get("traffic", {}).get("corridorTravelTimeDeltaPct", {})
    hotspot  = sim_result.get("thermal", {}).get("hotspotDeltaC", {})
    p50_tt   = corridor.get("p50", -4.1)
    p50_dt   = hotspot.get("p50", -2.3)

    events: list[tuple[str, dict]] = [
        _think("Αναλύω την εντολή…"),
        _think("Εντοπίζω την Πειραιώς στο γράφο κυκλοφορίας…"),
        _fly("corridor"),
        _layer("traffic", True),
        _think("Τρέχω προσομοίωση κυκλοφορίας και θερμοκρασίας…"),
        ("scenario.created", {"id": scenario_id, "title": title, "edits": edits,
                               "when": "2026-07-15T13:00:00+03:00", "origin": "user"}),
        ("sim.progress", {"scenarioId": scenario_id, "pct": 60}),
        ("sim.result", sim_result),
        _say(
            f"Το σενάριο δείχνει βελτίωση περίπου {abs(round(p50_tt))} τοις εκατό στον χρόνο διαδρομής "
            f"και μείωση θερμοκρασίας περίπου {abs(round(p50_dt, 1))} βαθμών στο hotspot.",
            mood="proud",
        ),
    ]

    if variant_result:
        v_corridor = variant_result.get("traffic", {}).get("corridorTravelTimeDeltaPct", {})
        v_hotspot  = variant_result.get("thermal", {}).get("hotspotDeltaC", {})
        v_p50_tt   = v_corridor.get("p50", p50_tt * 1.2)
        v_p50_dt   = v_hotspot.get("p50", p50_dt * 1.3)

        events += [
            _think("Δοκιμάζω 3 παραλλαγές αυτόματα…"),
            _think(f"Παραλλαγή 1: λιγότερα δέντρα → {abs(round(v_p50_dt,1))}°C"),
            _think(f"Παραλλαγή 2: περισσότερα δέντρα → {abs(round(v_p50_dt,1))}°C"),
            _think(f"Παραλλαγή 3: δέντρα + δροσερό πεζοδρόμιο → {abs(round(v_p50_dt*1.1,1))}°C ← καλύτερη"),
            ("variant.compare", {
                "base": sim_result,
                "best": variant_result,
                "reasonEl": (
                    f"Η παραλλαγή με δροσερό πεζοδρόμιο δίνει {abs(round(v_p50_dt*1.1,1))}°C "
                    f"λιγότερη θερμοκρασία με μόνο {abs(round(v_p50_tt,1))}% επιπλέον χρόνο διαδρομής."
                ),
            }),
            _say(
                f"Βρήκα μια καλύτερη παραλλαγή: αντί για μόνο δέντρα, συνδυάστε και δροσερό πεζοδρόμιο. "
                f"Κερδίζετε ακόμα {abs(round(v_p50_dt*0.1, 1))} βαθμό παραπάνω.",
                mood="proud",
            ),
        ]

    return events


def decision_sequence(decision_draft: dict) -> list[tuple[str, dict]]:
    """Events για το DECISION beat (4:00–4:30): typewriter στην οθόνη."""
    return [
        _think("Συντάσσω σχέδιο απόφασης Δημοτικού Συμβουλίου…"),
        _think("Ελέγχω παραπομπές νομοθεσίας…"),
        ("decision.ready", decision_draft),
        _say(
            "Ετοίμασα σχέδιο απόφασης για το Δημοτικό Συμβούλιο. "
            "Είναι ακόμα σε στάδιο σχεδίου — χρειάζεται έγκριση.",
            mood="proud",
        ),
    ]


def engage_sequence(before_url: str, after_url: str, consultation: dict) -> list[tuple[str, dict]]:
    return [
        _think("Δημιουργώ εικόνα before/after…"),
        _fly("streetLevel"),
        ("consultation.opened", consultation),
        _say(
            "Άνοιξα τη διαβούλευση. Μπορείτε να σκανάρετε το QR και να ψηφίσετε αν θέλετε αυτή την αλλαγή.",
            mood="neutral",
        ),
    ]


# ── keyword → intent (για mock command parsing) ────────────────────────────

def parse_intent_mock(text: str) -> str:
    """Αναγνωρίζει βασικές προθέσεις για το MOCK mode."""
    t = text.lower()
    if any(w in t for w in ["λωρίδα", "bus lane", "λεωφορείο"]):
        return "bus_lane"
    if any(w in t for w in ["δέντρ", "φύτεψ", "πρασίν"]):
        return "add_trees"
    if any(w in t for w in ["κλείσ", "κλείνω", "κλείσε"]):
        return "close_road"
    if any(w in t for w in ["ψύξ", "ψυχρ", "δροσερ", "cool"]):
        return "cool_pavement"
    if any(w in t for w in ["αφαίρ", "λωρίδ", "remove"]):
        return "remove_lane"
    if any(w in t for w in ["ιούλ", "καλοκαίρ", "καύσων"]):
        return "time_july"
    if any(w in t for w in ["μετρό", "τραμ", "τρένο"]):
        return "out_of_scope"
    if any(w in t for w in ["κλείσε όλη", "γκρέμισε", "σβήσε"]):
        return "out_of_scope_destructive"
    return "general"


def out_of_scope_say(intent: str) -> list[tuple[str, dict]]:
    if intent == "out_of_scope_destructive":
        return [_say(
            "Αυτό δεν μπορώ να το μοντελοποιήσω με αξιοπιστία. "
            "Μπορώ όμως να δοκιμάσω κλείσιμο συγκεκριμένης λωρίδας και να δω πού πηγαίνει η κυκλοφορία.",
            mood="neutral",
        )]
    return [_say(
        "Αυτή η υποδομή δεν ανήκει στην αρμοδιότητα που μοντελοποιώ ακόμα με αξιοπιστία. "
        "Μπορώ να δοκιμάσω παρεμβάσεις σε πεζοδρόμιο, δέντρα ή λωρίδες λεωφορείου.",
        mood="neutral",
    )]
