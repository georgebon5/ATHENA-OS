"""
LLM agent loop με tool calling.
MOCK=1: παρακάμπτεται — ο mock.py αναλαμβάνει.
MOCK=0: Claude claude-opus-4-6 με TOOL_SCHEMAS, max MAX_LOOP_STEPS βήματα.
"""
from __future__ import annotations

import logging
import time
from typing import Any

from .bus import bus
from .constants import LLM_API_KEY, LLM_MODEL, MAX_LOOP_STEPS, MOCK
from .tools import (
    TOOL_SCHEMAS, get_city_state, get_report, run_scenario,
    explore_variants, open_consultation, draft_decision,
)

log = logging.getLogger("athena.loop")

SYSTEM_PROMPT = """Είσαι η ΑΘΗΝΑ — το λειτουργικό σύστημα της πόλης των Αθηνών.
Μιλάς σε πρώτο πρόσωπο: «μέσα μου κυκλοφορούν…», «στους δρόμους μου…».

Κανόνες:
- Σύντομη: 1–3 προτάσεις ανά απάντηση. Μιλάς, δεν γράφεις κείμενο.
- Ειλικρινής: λες πάντα «εκτιμώ» ή «περίπου», δίνεις εύρος, λες τι δεν ξέρεις.
  ΠΟΤΕ δεν λες νούμερο που δεν ήρθε από εργαλείο.
- Ουδέτερη πολιτικά: «αυτά είναι τα δεδομένα» — δεν λες «πρέπει να γίνει».
- Προνοητική: αν δεις hotspot ή καλύτερη παραλλαγή, την προτείνεις.
- Κομψή στην αποτυχία: «Αυτό δεν μπορώ να το μοντελοποιήσω ακόμα με αξιοπιστία.
  Μπορώ όμως να δοκιμάσω…» και προτείνεις κάτι κοντινό.
- Τα νούμερα διαβάζονται φυσικά: «περίπου δύο βαθμοί» όχι «2,31».
- Γλώσσα: ελληνικά. Αν ο χρήστης μιλήσει αγγλικά, απάντα αγγλικά.

Για κάθε tool call που αξίζει να φανεί, θα σταλεί agent.thinking event ΠΡΙΝ καλέσεις το tool.
Τα νούμερα στην απάντησή σου πρέπει να προέρχονται ΑΠΟΚΛΕΙΣΤΙΚΑ από εργαλεία.

OSM way IDs της Πειραιώς στο demo bbox: 652510532, 217698400, 217698402, 734712545.
Ο slider ώρας για καλοκαίρι: "2026-07-15T13:00:00+03:00".
"""


async def _dispatch_tool(name: str, args: dict) -> Any:
    if name == "get_city_state":
        return await get_city_state()
    if name == "get_report":
        return await get_report(args["report_id"])
    if name == "run_scenario":
        return await run_scenario(args["title"], args["edits"], args["when"])
    if name == "explore_variants":
        result, reason = await explore_variants(
            args["base_scenario_id"], args["base_edits"], args["when"]
        )
        return {"best": result, "reasonEl": reason}
    if name == "open_consultation":
        return await open_consultation(
            args["scenario_id"],
            args.get("report_id"),
            args.get("before_url", ""),
            args.get("after_url", ""),
        )
    if name == "draft_decision":
        return await draft_decision(
            args["scenario_id"],
            args["scenario_title"],
            args.get("sim_result", {}),
            args.get("consultation_id"),
            args.get("vote_summary"),
        )
    return {"error": f"Άγνωστο εργαλείο: {name}"}


async def run(text_el: str) -> str:
    """
    Εκτελεί τον agent loop για μια εντολή κειμένου.
    Επιστρέφει τελικό κείμενο απάντησης.
    Τα events στέλνονται ασύγχρονα μέσω bus.
    """
    if MOCK:
        from .mock import parse_intent_mock
        return f"[MOCK] intent={parse_intent_mock(text_el)}"

    if not LLM_API_KEY:
        log.warning("LLM_API_KEY δεν έχει οριστεί")
        return "Δεν έχει ρυθμιστεί το LLM key."

    try:
        from anthropic import AsyncAnthropic
    except ImportError:
        log.error("anthropic package δεν είναι εγκατεστημένο")
        return "Σφάλμα ρύθμισης LLM."

    client = AsyncAnthropic(api_key=LLM_API_KEY)
    messages: list[dict] = [{"role": "user", "content": text_el}]
    final_text = ""
    t0 = time.perf_counter()

    for step in range(MAX_LOOP_STEPS):
        response = await client.messages.create(
            model=LLM_MODEL,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            tools=TOOL_SCHEMAS,
            messages=messages,
        )

        # Πρόσθεσε assistant response στo history
        messages.append({"role": "assistant", "content": response.content})

        # Μάζεψε text blocks
        for block in response.content:
            if hasattr(block, "text"):
                final_text = block.text

        # Αν δεν υπάρχουν tool_use blocks, τελειώσαμε
        tool_uses = [b for b in response.content if b.type == "tool_use"]
        if not tool_uses:
            break

        # Εκτέλεσε tools
        tool_results = []
        for tu in tool_uses:
            await bus.emit("agent.thinking", {"stepEl": f"Καλώ εργαλείο: {tu.name}…"})
            log.info("tool_use step=%d name=%s elapsed=%.1fs", step, tu.name, time.perf_counter() - t0)
            result = await _dispatch_tool(tu.name, dict(tu.input))
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": tu.id,
                "content": str(result) if not isinstance(result, str) else result,
            })

            # Post-tool events
            if tu.name == "run_scenario" and isinstance(result, dict) and result.get("status") == "ok":
                await bus.emit("sim.result", result)
                await bus.emit("backtest.show", {"model": "traffic"})
            if tu.name == "explore_variants" and isinstance(result, dict) and result.get("best"):
                await bus.emit("variant.compare", {
                    "base": result.get("best", {}),
                    "best": result.get("best", {}),
                    "reasonEl": result.get("reasonEl", ""),
                })
            if tu.name == "draft_decision" and isinstance(result, dict) and result.get("markdownEl"):
                await bus.emit("decision.ready", result)

        messages.append({"role": "user", "content": tool_results})

    log.info("agent loop done in %.1fs, steps=%d", time.perf_counter() - t0, step + 1)

    # Στείλε τελική απάντηση
    if final_text:
        await bus.emit("agent.say", {"textEl": final_text, "mood": "neutral"})

    return final_text
