"""
ATHENA Agent service — port 8200.

Endpoints:
  POST /voice          multipart: audio/webm → STT → agent loop → events
  POST /command        { textEl } → agent loop → events
  POST /classify       { reportId } → vision → report.classified event
  POST /intro          → intro speech με live νούμερα
  GET  /health
"""
from __future__ import annotations

import logging
import sys
import time
from contextlib import asynccontextmanager
from typing import Annotated

import httpx
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Logging ───────────────────────────────────────────────────────────────
logging.basicConfig(
    stream=sys.stdout,
    level=logging.INFO,
    format="%(asctime)s.%(msecs)03d %(levelname)s %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("athena.main")

from agent.bus import bus
from agent.constants import GATEWAY_URL, MOCK, PORT
from agent.tools import get_city_state, get_report, open_consultation


# ── Lifespan ───────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    mode = "MOCK" if MOCK else "LIVE"
    log.info("ATHENA agent — %s mode, port %s", mode, PORT)
    await bus.start()
    yield
    await bus.stop()


# ── App ────────────────────────────────────────────────────────────────────

app = FastAPI(title="ATHENA Agent", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Models ─────────────────────────────────────────────────────────────────

class CommandRequest(BaseModel):
    textEl: str
    beatHint: str | None = None

class CommandResponse(BaseModel):
    textEl: str
    audioUrl: str | None = None
    eventsQueued: int = 0

class ClassifyRequest(BaseModel):
    reportId: str

class ClassifyResponse(BaseModel):
    reportId: str
    classification: dict


# ── GET /health ────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "mock": MOCK,
        "gatewayConnected": bus.connected,
        "gateway": GATEWAY_URL,
    }


# ── POST /intro ────────────────────────────────────────────────────────────

@app.post("/intro")
async def intro():
    """
    Beat INTRO (0:00–0:40): εισαγωγική ομιλία με live νούμερα.
    Στέλνει: riseToOverview → layer.set(buses) → agent.say (live αριθμοί)
             → orbitSerafio → layer.set(thermal) → agent.say (hotspot)
    """
    t0 = time.perf_counter()
    city = await get_city_state()

    from agent.mock import intro_sequence
    from agent.tts import synthesize

    events = intro_sequence(city)

    # Στείλε sequence με χρονικά κενά για κινηματογραφικό αποτέλεσμα
    for event_type, payload in events:
        if event_type == "agent.say":
            audio_url = await synthesize(payload["textEl"], GATEWAY_URL)
            if audio_url:
                payload = {**payload, "audioUrl": audio_url}
            await bus.emit(event_type, payload)
            import asyncio; await asyncio.sleep(0.5)
        elif event_type == "camera.flyTo":
            await bus.emit(event_type, payload)
            import asyncio; await asyncio.sleep(0.3)
        else:
            await bus.emit(event_type, payload)

    return {"ok": True, "computeMs": int((time.perf_counter() - t0) * 1000)}


# ── POST /command ──────────────────────────────────────────────────────────

@app.post("/command", response_model=CommandResponse)
async def command(req: CommandRequest):
    """
    Text command από director panel (πλήκτρο T) ή agent χωρίς STT.
    MOCK: routes σε mock sequence. LIVE: LLM tool-calling loop.
    """
    t0 = time.perf_counter()
    log.info("command: '%s' beat=%s", req.textEl, req.beatHint)

    if MOCK:
        response_text, n_events = await _mock_command(req.textEl, req.beatHint)
    else:
        from agent.loop import run
        response_text = await run(req.textEl)
        n_events = 0

    audio_url = None
    if response_text:
        from agent.tts import synthesize
        audio_url = await synthesize(response_text, GATEWAY_URL)

    log.info("command done in %.1fs", time.perf_counter() - t0)
    return CommandResponse(textEl=response_text, audioUrl=audio_url, eventsQueued=n_events)


async def _mock_command(text: str, beat: str | None) -> tuple[str, int]:
    """Mock routing: keyword → event sequence."""
    from agent.mock import (
        parse_intent_mock, out_of_scope_say, simulate_sequence,
        PIREOS_WAY_IDS, _scenario_payload,
    )
    from agent.tools import run_scenario, explore_variants
    import json
    from pathlib import Path
    from agent.constants import FIXTURES_DIR

    intent = parse_intent_mock(text)
    n = 0

    if intent in ("out_of_scope", "out_of_scope_destructive"):
        events = out_of_scope_say(intent)
        for et, p in events:
            await bus.emit(et, p)
            n += 1
        return events[-1][1].get("textEl", ""), n

    if intent == "time_july":
        await bus.emit("time.set", {"when": "2026-07-15T13:00:00+03:00"})
        await bus.emit("agent.say", {"textEl": "Μεταφέρω στον Ιούλιο του 2026, ώρα 13:00. Δείτε πώς αλλάζει το θερμικό.", "mood": "neutral"})
        return "Μεταφέρω στον Ιούλιο του 2026.", 2

    # Κατασκεύασε edits βάσει intent
    when = "2026-07-15T13:00:00+03:00"
    if intent == "bus_lane":
        edits = [{"type": "bus_lane", "wayIds": PIREOS_WAY_IDS}]
        title = "Λωρίδα λεωφορείου στην Πειραιώς"
    elif intent == "add_trees":
        edits = [{"type": "add_trees", "geometry": [[23.711, 37.975], [23.712, 37.977]], "count": 42, "side": "both"}]
        title = "42 δέντρα στην Πειραιώς"
    elif intent == "cool_pavement":
        edits = [{"type": "cool_pavement", "wayIds": PIREOS_WAY_IDS}]
        title = "Δροσερό πεζοδρόμιο στην Πειραιώς"
    elif intent == "close_road":
        edits = [{"type": "close_road", "wayIds": [652510532]}]
        title = "Κλείσιμο τμήματος Πειραιώς"
    else:
        # general — λωρίδα + δέντρα (το πιο εντυπωσιακό)
        edits = [
            {"type": "bus_lane", "wayIds": PIREOS_WAY_IDS},
            {"type": "add_trees", "geometry": [[23.711, 37.975], [23.712, 37.977]], "count": 42, "side": "both"},
        ]
        title = "Λωρίδα λεωφορείου + δέντρα στην Πειραιώς"

    # Thinking events
    await bus.emit("agent.thinking", {"stepEl": "Αναλύω την εντολή…"})
    await bus.emit("agent.thinking", {"stepEl": "Εντοπίζω την Πειραιώς στο γράφο κυκλοφορίας…"})
    await bus.emit("camera.flyTo", {"lngLat": [23.712, 37.9764], "heightM": 350, "headingDeg": 350, "pitchDeg": -45, "durationS": 4})
    await bus.emit("layer.set", {"layer": "traffic", "visible": True})
    await bus.emit("agent.thinking", {"stepEl": "Τρέχω προσομοίωση κυκλοφορίας και θερμοκρασίας…"})
    n += 5

    # Τρέξε sim
    sim_result = await run_scenario(title, edits, when)

    if sim_result.get("status") == "error":
        # Fallback στο cache fixture
        fp = FIXTURES_DIR / "sim_result.json"
        if fp.exists():
            import json as _json
            sim_result = _json.loads(fp.read_text())
            sim_result["scenarioId"] = f"s-fallback-{intent}"

    corridor_p50 = sim_result.get("traffic", {}).get("corridorTravelTimeDeltaPct", {}).get("p50", -4.1)
    hotspot_p50  = sim_result.get("thermal", {}).get("hotspotDeltaC", {}).get("p50", -2.3)
    scenario_id  = sim_result.get("scenarioId", "s-demo")

    await bus.emit("scenario.created", {"id": scenario_id, "title": title, "edits": edits,
                                         "when": when, "origin": "user"})
    await bus.emit("sim.result", sim_result)
    n += 2

    reply = (
        f"Το σενάριο δείχνει βελτίωση περίπου {abs(round(corridor_p50))} τοις εκατό στον χρόνο διαδρομής "
        f"και μείωση θερμοκρασίας περίπου {abs(round(hotspot_p50, 1))} βαθμών στο hotspot."
    )
    await bus.emit("agent.say", {"textEl": reply, "mood": "proud"})
    n += 1

    # Explore variants (αν δεν είναι close_road — δεν βγαίνουν ενδιαφέρουσες παραλλαγές)
    if intent != "close_road":
        import asyncio
        await asyncio.sleep(1.0)  # pause για εφέ
        await bus.emit("agent.thinking", {"stepEl": "Δοκιμάζω 3 παραλλαγές αυτόματα…"})
        best_result, reason = await explore_variants(scenario_id, edits, when)
        n += 1

        if best_result and best_result.get("status") == "ok":
            b_hot  = best_result.get("thermal", {}).get("hotspotDeltaC", {}).get("p50", hotspot_p50 * 1.3)
            b_corr = best_result.get("traffic", {}).get("corridorTravelTimeDeltaPct", {}).get("p50", corridor_p50)
            await bus.emit("agent.thinking", {"stepEl": f"Καλύτερη παραλλαγή: {abs(round(b_hot,1))}°C με {abs(round(b_corr,1))}% αλλαγή κυκλοφορίας"})
            await bus.emit("variant.compare", {
                "base": sim_result,
                "best": best_result,
                "reasonEl": reason,
            })
            variant_say = (
                f"Βρήκα μια καλύτερη παραλλαγή. {reason} "
                f"Θέλετε να την υιοθετήσουμε;"
            )
            await bus.emit("agent.say", {"textEl": variant_say, "mood": "proud"})
            reply = variant_say
            n += 3

    return reply, n


# ── POST /voice ────────────────────────────────────────────────────────────

@app.post("/voice", response_model=CommandResponse)
async def voice(
    audio: Annotated[UploadFile, File()],
    beat: Annotated[str | None, Form()] = None,
):
    """STT → command."""
    from agent.stt import transcribe
    audio_bytes = await audio.read()
    text = await transcribe(audio_bytes, audio.content_type or "audio/webm")
    log.info("voice transcript: '%s'", text)

    # Δείξε transcript στο UI
    await bus.emit("agent.thinking", {"stepEl": f"Άκουσα: «{text}»"})

    # Χρήση ίδιας λογικής με /command
    req = CommandRequest(textEl=text, beatHint=beat)
    return await command(req)


# ── POST /classify ─────────────────────────────────────────────────────────

@app.post("/classify", response_model=ClassifyResponse)
async def classify(req: ClassifyRequest):
    """
    Καλείται από τον gateway όταν δημιουργηθεί αναφορά.
    Κατεβάζει φωτογραφία → vision classify → report.classified event.
    """
    from agent.classify import classify_photo, fetch_photo
    from agent.mock import classify_say_sequence

    # Φέρε report
    report = await get_report(req.reportId)
    if not report:
        raise HTTPException(status_code=404, detail=f"Report {req.reportId} not found")

    photo_url = report.get("photoUrl", "")
    location  = report.get("location")

    # Classify
    if photo_url and not MOCK:
        try:
            photo_bytes = await fetch_photo(photo_url)
            classification = await classify_photo(photo_bytes, tuple(location) if location else None)
        except Exception as e:
            log.warning("photo fetch/classify failed: %s — mock fallback", e)
            from agent.mock import mock_classification
            classification = mock_classification(req.reportId)
    else:
        from agent.mock import mock_classification
        classification = mock_classification(req.reportId)

    # Broadcast report.classified
    classified_report = {**report, "classification": classification}
    await bus.emit("report.classified", classified_report)

    # ATHENA μιλάει (hotspot check)
    is_hotspot = (
        classification.get("category") == "heat_exposure" or
        classification.get("severity", 0) >= 4
    )
    for et, payload in classify_say_sequence(classification, is_hotspot):
        if et == "report.classified":
            continue  # ήδη στάλθηκε
        await bus.emit(et, payload)

    return ClassifyResponse(reportId=req.reportId, classification=classification)
