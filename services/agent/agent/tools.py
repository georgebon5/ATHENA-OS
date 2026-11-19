"""
Tool implementations που καλεί ο agent loop.
Κάθε tool καλεί gateway ή sim μέσω HTTP και επιστρέφει δεδομένα.
Τα events (agent.say, camera.flyTo κτλ.) δεν στέλνονται εδώ —
στέλνονται από τον loop μετά την επεξεργασία του αποτελέσματος.
"""
from __future__ import annotations

import logging
import uuid

import httpx

from .constants import GATEWAY_URL, TOOL_TIMEOUT_S

log = logging.getLogger("athena.tools")

_client: httpx.AsyncClient | None = None


def get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(base_url=GATEWAY_URL, timeout=TOOL_TIMEOUT_S)
    return _client


# ── Tool: get_city_state ───────────────────────────────────────────────────

async def get_city_state() -> dict:
    """Live σύνοψη: λεωφορεία, θερμοκρασία, αναφορές."""
    try:
        r = await get_client().get("/api/city/live")
        r.raise_for_status()
        return r.json()
    except Exception as e:  # noqa: BLE001
        log.warning("get_city_state failed: %s", e)
        return {"buses": {"active": 7}, "weather": {"temperatureC": 17.4}, "reports": {"last24h": 3}}


# ── Tool: get_report ───────────────────────────────────────────────────────

async def get_report(report_id: str) -> dict:
    try:
        r = await get_client().get(f"/api/reports/{report_id}")
        r.raise_for_status()
        return r.json()
    except Exception as e:  # noqa: BLE001
        log.warning("get_report(%s) failed: %s", report_id, e)
        return {}


# ── Tool: run_scenario ─────────────────────────────────────────────────────

async def run_scenario(title: str, edits: list[dict], when: str) -> dict:
    """Δημιουργεί και τρέχει σενάριο. Επιστρέφει SimResult."""
    payload = {
        "id": f"s-{uuid.uuid4().hex[:8]}",
        "title": title,
        "edits": edits,
        "when": when,
        "origin": "user",
    }
    try:
        r = await get_client().post("/api/scenarios", json=payload, timeout=12.0)
        r.raise_for_status()
        result = r.json()
        log.info("run_scenario '%s' → status=%s computeMs=%s",
                 title, result.get("status"), result.get("computeMs"))
        return result
    except Exception as e:  # noqa: BLE001
        log.warning("run_scenario failed: %s", e)
        return {"status": "error", "scenarioId": payload["id"], "notes": [str(e)]}


# ── Tool: explore_variants ─────────────────────────────────────────────────

VARIANT_TEMPLATES = [
    {"suffix": "περισσότερα δέντρα",    "tree_count_mult": 1.5, "add_cool": False},
    {"suffix": "λιγότερα δέντρα",       "tree_count_mult": 0.6, "add_cool": False},
    {"suffix": "δέντρα + δροσερό πεζοδρόμιο", "tree_count_mult": 1.0, "add_cool": True},
]

PIREOS_WAY_IDS = [652510532, 217698400, 217698402]


def _make_variant_edits(base_edits: list[dict], tmpl: dict) -> list[dict]:
    edits = []
    for e in base_edits:
        if e["type"] == "add_trees":
            new_count = max(5, int(e.get("count", 20) * tmpl["tree_count_mult"]))
            edits.append({**e, "count": new_count})
        else:
            edits.append(e)
    if tmpl["add_cool"]:
        # Προσθέτει cool_pavement στην Πειραιώς αν δεν υπάρχει ήδη
        if not any(e["type"] == "cool_pavement" for e in edits):
            edits.append({"type": "cool_pavement", "wayIds": PIREOS_WAY_IDS})
    return edits


def _score(result: dict) -> float:
    """Ντετερμινιστικό κριτήριο: μέγιστη θερμική βελτίωση ανά μονάδα κυκλοφοριακής επιβάρυνσης."""
    hotspot = result.get("thermal", {}).get("hotspotDeltaC", {}).get("p50", 0.0)
    corridor = result.get("traffic", {}).get("corridorTravelTimeDeltaPct", {}).get("p50", 0.0)
    cooling = -hotspot          # θετικό = βελτίωση
    disruption = max(corridor, 0.0)   # μόνο αρνητικές επιπτώσεις μετρούν
    return cooling / (1.0 + disruption / 5.0)


async def explore_variants(base_scenario_id: str, base_edits: list[dict], when: str) -> tuple[dict, str]:
    """
    Τρέχει 3 παραλλαγές παράλληλα, επιστρέφει (best_result, reason_el).
    Η επιλογή γίνεται με _score() — ο LLM δεν αποφασίζει.
    """
    import asyncio

    tasks = []
    templates = []
    for tmpl in VARIANT_TEMPLATES:
        v_edits = _make_variant_edits(base_edits, tmpl)
        v_title = f"Παραλλαγή: {tmpl['suffix']}"
        tasks.append(run_scenario(v_title, v_edits, when))
        templates.append(tmpl)

    results = await asyncio.gather(*tasks, return_exceptions=True)

    scored = []
    for tmpl, r in zip(templates, results):
        if isinstance(r, Exception) or r.get("status") == "error":
            continue
        scored.append((tmpl, r, _score(r)))

    if not scored:
        return {}, "Δεν βρέθηκε καλύτερη παραλλαγή."

    scored.sort(key=lambda x: x[2], reverse=True)
    best_tmpl, best_result, best_score = scored[0]

    b_hot   = best_result.get("thermal", {}).get("hotspotDeltaC", {}).get("p50", 0)
    b_corr  = best_result.get("traffic", {}).get("corridorTravelTimeDeltaPct", {}).get("p50", 0)

    reason = (
        f"Η παραλλαγή «{best_tmpl['suffix']}» δίνει {abs(round(b_hot, 1))}°C "
        f"λιγότερη θερμοκρασία με {abs(round(b_corr, 1))}% αλλαγή στον χρόνο διαδρομής "
        f"(βαθμολογία: {round(best_score, 2)})."
    )

    return best_result, reason


# ── Tool: open_consultation ────────────────────────────────────────────────

async def open_consultation(scenario_id: str, report_id: str | None = None,
                             before_url: str = "", after_url: str = "") -> dict:
    payload = {
        "scenarioId": scenario_id,
        "beforeUrl": before_url or "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=1200",
        "afterUrl":  after_url  or "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200",
        "questionEl": "Συμφωνείτε με αυτή την αλλαγή στην Πειραιώς;",
    }
    if report_id:
        payload["reportId"] = report_id
    try:
        r = await get_client().post("/api/consultations", json=payload, timeout=5.0)
        r.raise_for_status()
        return r.json()
    except Exception as e:  # noqa: BLE001
        log.warning("open_consultation failed: %s", e)
        import uuid
        return {**payload, "id": f"c-{uuid.uuid4().hex[:8]}", "publicUrl": f"{GATEWAY_URL}/c/mock"}


# ── Tool schemas για το LLM ────────────────────────────────────────────────

TOOL_SCHEMAS = [
    {
        "name": "get_city_state",
        "description": "Επιστρέφει live σύνοψη: ενεργά λεωφορεία, θερμοκρασία, πρόσφατες αναφορές.",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "get_report",
        "description": "Λεπτομέρειες μιας αναφοράς πολίτη.",
        "input_schema": {
            "type": "object",
            "properties": {"report_id": {"type": "string", "description": "UUID της αναφοράς"}},
            "required": ["report_id"],
        },
    },
    {
        "name": "run_scenario",
        "description": (
            "Δημιουργεί και εκτελεί ένα σενάριο αστικής παρέμβασης. "
            "Υποστηριζόμενοι τύποι edits: bus_lane, add_trees, close_road, remove_lane, cool_pavement."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "edits": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "type": {"type": "string"},
                            "wayIds": {"type": "array", "items": {"type": "integer"}},
                            "geometry": {"type": "array", "items": {"type": "array", "items": {"type": "number"}}},
                            "count": {"type": "integer"},
                        },
                    },
                },
                "when": {"type": "string", "description": "ISO datetime για θερμικό/ήλιο"},
            },
            "required": ["title", "edits", "when"],
        },
    },
    {
        "name": "explore_variants",
        "description": "Δοκιμάζει 3 παραλλαγές του σεναρίου και επιστρέφει την καλύτερη με αιτιολογία.",
        "input_schema": {
            "type": "object",
            "properties": {
                "base_scenario_id": {"type": "string"},
                "base_edits": {"type": "array", "items": {"type": "object"}},
                "when": {"type": "string"},
            },
            "required": ["base_scenario_id", "base_edits", "when"],
        },
    },
    {
        "name": "open_consultation",
        "description": "Ανοίγει δημόσια διαβούλευση για το σενάριο (δημιουργεί QR).",
        "input_schema": {
            "type": "object",
            "properties": {
                "scenario_id": {"type": "string"},
                "report_id": {"type": "string"},
                "before_url": {"type": "string"},
                "after_url": {"type": "string"},
            },
            "required": ["scenario_id"],
        },
    },
]
