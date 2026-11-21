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

async def run_scenario(
    title: str, edits: list[dict], when: str, *,
    broadcast: bool = True, origin: str = "user", parent_id: str | None = None,
) -> dict:
    """Δημιουργεί και τρέχει σενάριο. Επιστρέφει SimResult. broadcast=False: δεν αλλάζει η οθόνη."""
    payload = {
        "id": f"s-{uuid.uuid4().hex[:8]}",
        "title": title,
        "edits": edits,
        "when": when,
        "origin": origin,
    }
    if parent_id:
        payload["parentId"] = parent_id
    try:
        r = await get_client().post(
            "/api/scenarios", json=payload, params={"broadcast": str(broadcast).lower()}, timeout=12.0
        )
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
        # Σιωπηλά: η οθόνη δείχνει μόνο τη σύγκριση (variant.compare), όχι κάθε δοκιμή
        tasks.append(run_scenario(v_title, v_edits, when, broadcast=False,
                                  origin="agent_variant", parent_id=base_scenario_id))
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
        f"Η παραλλαγή «{best_tmpl['suffix']}» δίνει {b_hot:+.1f}°C στη θερμοκρασία επιφάνειας "
        f"και {b_corr:+.1f}% στον χρόνο διαδρομής (βαθμολογία: {round(best_score, 2)})."
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


# ── Tool: render_before_after ──────────────────────────────────────────────

async def render_before_after(photo_url: str, scenario_title: str) -> tuple[str, str]:
    """
    Δημιουργεί before/after εικόνες για τη διαβούλευση.
    Χωρίς IMAGE_EDIT_API_KEY επιστρέφει placeholder Unsplash URLs.
    """
    from .constants import IMAGE_EDIT_API_KEY
    if not IMAGE_EDIT_API_KEY:
        before = photo_url or "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=1200"
        after  = "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200"
        return before, after
    # Placeholder — ο κάλογος image editing API πηγαίνει εδώ (π.χ. OpenAI edits)
    before = photo_url or "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=1200"
    after  = "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200"
    return before, after


# ── Tool: draft_decision ───────────────────────────────────────────────────

def fmt_range(rng: dict, unit: str) -> str:
    """«**+0.0%** (εύρος +0.0% έως +0.1%)» με τα πραγματικά p10/p50/p90 του sim· ποτέ επινοημένα."""
    if not rng or "p50" not in rng:
        return "δεν υπάρχει αποτέλεσμα προσομοίωσης"
    if rng["p10"] == rng["p50"] == rng["p90"] == 0:
        return "καμία μεταβολή"
    return f"**{rng['p50']:+.1f}{unit}** (εύρος {rng['p10']:+.1f}{unit} έως {rng['p90']:+.1f}{unit})"


def _mock_decision(
    scenario_id: str,
    scenario_title: str,
    sim_result: dict,
    consultation_id: str | None,
    vote_summary: dict | None,
) -> dict:
    corridor = sim_result.get("traffic", {}).get("corridorTravelTimeDeltaPct", {})
    hotspot  = sim_result.get("thermal", {}).get("hotspotDeltaC", {})

    if vote_summary:
        yes   = vote_summary.get("yes", 0)
        no    = vote_summary.get("no", 0)
        maybe = vote_summary.get("maybe", 0)
        total = yes + no + maybe or 1
        pct   = round(yes / total * 100)
        votes_section = f"Διαδικτυακή διαβούλευση: {yes} ΝΑΙ / {no} ΟΧΙ / {maybe} ΙΣΩΣ ({total} συμμετοχές, {pct}% θετικό)."
    elif consultation_id:
        votes_section = f"Διαβούλευση υπ' αριθμ. {consultation_id} — αποτελέσματα εκκρεμούν."
    else:
        votes_section = "Εκκρεμεί διαβούλευση με τους κατοίκους."

    markdown = f"""# ΣΧΕΔΙΟ ΑΠΟΦΑΣΗΣ — δεν έχει εγκριθεί

## ΘΕΜΑ
Έγκριση πιλοτικής εφαρμογής «{scenario_title}» στην οδό Πειραιώς (τμήμα Θησείο–Σεράφειο)

## ΣΚΕΠΤΙΚΟ
Η οδός Πειραιώς αποτελεί έναν από τους πιο θερμικά επιβαρυμένους αστικούς αξόνες του κέντρου. \
Η παρούσα παρέμβαση αποσκοπεί στη βελτίωση της βιωσιμότητας του δημόσιου χώρου και στη μείωση \
του φαινομένου της αστικής θερμικής νησίδας, σύμφωνα με τον Κλιματικό Νόμο 4936/2022.

## ΔΕΔΟΜΕΝΑ
Σύμφωνα με προσομοίωση του συστήματος ATHENA-OS *(εκτίμηση — δεν αποτελεί επίσημη μελέτη)*:
- Αλλαγή χρόνου διαδρομής κορυφαίας ώρας: {fmt_range(corridor, "%")}
- Μεταβολή θερμοκρασίας επιφάνειας hotspot: {fmt_range(hotspot, "°C")}

## ΔΙΑΒΟΥΛΕΥΣΗ
{votes_section}

## ΑΠΟΦΑΣΙΖΕΙ
1. Εγκρίνει πιλοτική εφαρμογή διάρκειας **3 μηνών** στην οδό Πειραιώς (τμήμα 500 μ. νότια του Σεραφείου).
2. Αναθέτει στη Διεύθυνση Πρασίνου & Αστικής Πανίδας την εκτέλεση των εργασιών εντός 30 ημερών.
3. Ορίζει επαναξιολόγηση μετά το πέρας του πιλότου με δεδομένα αισθητήρων και πολιτών."""

    return {
        "scenarioId": scenario_id,
        "markdownEl": markdown,
        "citations": [
            {"label": "Κλιματικός Νόμος 4936/2022", "source": "ΦΕΚ 105Α/2022"},
            {"label": "Προσομοίωση κυκλοφορίας", "source": "ATHENA-OS / Frank-Wolfe UE"},
            {"label": "Θερμικό μοντέλο LST", "source": "ATHENA-OS / Physics LST"},
        ],
    }


async def draft_decision(
    scenario_id: str,
    scenario_title: str,
    sim_result: dict,
    consultation_id: str | None = None,
    vote_summary: dict | None = None,
) -> dict:
    """
    Γεννάει DecisionDraft (ΘΕΜΑ/ΣΚΕΠΤΙΚΟ/ΔΕΔΟΜΕΝΑ/ΔΙΑΒΟΥΛΕΥΣΗ/ΑΠΟΦΑΣΙΖΕΙ).
    MOCK=0 + LLM_API_KEY: Claude claude-opus-4-6 generates Greek municipal decision.
    """
    from .constants import LLM_API_KEY, LLM_MODEL, MOCK
    if MOCK or not LLM_API_KEY:
        return _mock_decision(scenario_id, scenario_title, sim_result, consultation_id, vote_summary)

    try:
        from anthropic import AsyncAnthropic

        corridor = sim_result.get("traffic", {}).get("corridorTravelTimeDeltaPct", {})
        hotspot  = sim_result.get("thermal", {}).get("hotspotDeltaC", {})

        votes_text = ""
        if vote_summary:
            yes   = vote_summary.get("yes", 0)
            no    = vote_summary.get("no", 0)
            maybe = vote_summary.get("maybe", 0)
            total = yes + no + maybe or 1
            votes_text = f"\nΔιαβούλευση: {yes} ΝΑΙ / {no} ΟΧΙ / {maybe} ΙΣΩΣ ({total} ψήφοι)"

        prompt = (
            f"Σενάριο: {scenario_title}\n"
            f"Αλλαγή χρόνου διαδρομής: {fmt_range(corridor, '%')}\n"
            f"Μεταβολή θερμοκρασίας hotspot: {fmt_range(hotspot, '°C')}{votes_text}\n\n"
            "Γράψε σχέδιο απόφασης Δημοτικού Συμβουλίου Αθηναίων με δομή:\n"
            "# ΣΧΕΔΙΟ ΑΠΟΦΑΣΗΣ — δεν έχει εγκριθεί\n"
            "## ΘΕΜΑ\n## ΣΚΕΠΤΙΚΟ\n## ΔΕΔΟΜΕΝΑ\n## ΔΙΑΒΟΥΛΕΥΣΗ\n## ΑΠΟΦΑΣΙΖΕΙ\n\n"
            "Μέγιστο 300 λέξεις. Χρησιμοποίησε ΜΟΝΟ τους αριθμούς και τα εύρη που δίνονται, χωρίς να "
            "προσθέσεις άλλους. Τόνος επίσημος/δημοτικός."
        )

        client = AsyncAnthropic(api_key=LLM_API_KEY)
        resp = await client.messages.create(
            model=LLM_MODEL,
            max_tokens=700,
            system=(
                "Είσαι νομικός σύμβουλος του Δήμου Αθηναίων. "
                "Γράφεις επίσημα διοικητικά κείμενα στα ελληνικά. "
                "Επιστρέφεις ΜΟΝΟ το κείμενο της απόφασης, χωρίς εισαγωγές ή σχόλια."
            ),
            messages=[{"role": "user", "content": prompt}],
        )
        markdown = resp.content[0].text.strip()
        return {
            "scenarioId": scenario_id,
            "markdownEl": markdown,
            "citations": [
                {"label": "Κλιματικός Νόμος 4936/2022", "source": "ΦΕΚ 105Α/2022"},
                {"label": "Προσομοίωση ATHENA-OS", "source": "Frank-Wolfe UE + Physics LST"},
            ],
        }
    except Exception as e:
        log.warning("draft_decision LLM failed: %s — χρήση mock", e)
        return _mock_decision(scenario_id, scenario_title, sim_result, consultation_id, vote_summary)


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
    {
        "name": "draft_decision",
        "description": (
            "Συντάσσει σχέδιο απόφασης Δημοτικού Συμβουλίου για εγκεκριμένο σενάριο. "
            "Καλείται ΜΕΤΑ το run_scenario και, αν υπάρχει, μετά το open_consultation."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "scenario_id": {"type": "string"},
                "scenario_title": {"type": "string"},
                "sim_result": {"type": "object", "description": "SimResult από run_scenario"},
                "consultation_id": {"type": "string"},
                "vote_summary": {
                    "type": "object",
                    "properties": {
                        "yes": {"type": "integer"},
                        "no": {"type": "integer"},
                        "maybe": {"type": "integer"},
                    },
                },
            },
            "required": ["scenario_id", "scenario_title", "sim_result"],
        },
    },
]
