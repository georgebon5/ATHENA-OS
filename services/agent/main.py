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
from agent.tools import get_city_state, get_report, open_consultation, render_before_after, draft_decision


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
    imageBase64: str | None = None  # ο gateway στέλνει τη φωτογραφία: δεν χρειάζεται fetch (Docker: άλλο host)

class ClassifyResponse(BaseModel):
    reportId: str
    classification: dict

class ConsultRequest(BaseModel):
    scenarioId: str
    scenarioTitle: str = "Παρέμβαση στην Πειραιώς"
    reportId: str | None = None
    photoUrl: str | None = None
    simResult: dict | None = None

class ConsultResponse(BaseModel):
    consultationId: str
    publicUrl: str
    eventsQueued: int = 0

class DecisionRequest(BaseModel):
    scenarioId: str
    scenarioTitle: str = "Παρέμβαση στην Πειραιώς"
    consultationId: str | None = None
    simResult: dict | None = None
    voteSummary: dict | None = None

class DecisionResponse(BaseModel):
    markdownEl: str
    eventsQueued: int = 0


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
        parse_intent_mock, out_of_scope_say, PIREOS_WAY_IDS,
    )
    from agent.tools import run_scenario, explore_variants

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

    if sim_result.get("status") != "ok":
        # Ο gateway έχει ήδη δοκιμάσει live + cached. Δεν εφευρίσκουμε νούμερα.
        reply = "Η προσομοίωση δεν ολοκληρώθηκε αυτή τη φορά. Δεν θα σας δώσω νούμερα χωρίς αποτέλεσμα."
        await bus.emit("agent.say", {"textEl": reply, "mood": "alert"})
        return reply, n + 1

    hotspot_p50  = sim_result["thermal"]["hotspotDeltaC"]["p50"]
    scenario_id  = sim_result["scenarioId"]
    # Ο gateway έχει ήδη στείλει scenario.created + sim.result (broadcast)
    reply = describe_result(sim_result)
    await bus.emit("agent.say", {"textEl": reply, "mood": "proud"})
    n += 1

    # Explore variants (αν δεν είναι close_road — δεν βγαίνουν ενδιαφέρουσες παραλλαγές)
    if intent != "close_road":
        import asyncio
        await asyncio.sleep(1.0)  # pause για εφέ
        await bus.emit("agent.thinking", {"stepEl": "Δοκιμάζω 3 παραλλαγές αυτόματα…"})
        best_result, reason = await explore_variants(scenario_id, edits, when)
        n += 1

        if best_result and best_result.get("status") == "ok" and (
            best_result["thermal"]["hotspotDeltaC"]["p50"] < hotspot_p50
        ):
            b_hot  = best_result["thermal"]["hotspotDeltaC"]["p50"]
            b_corr = best_result["traffic"]["corridorTravelTimeDeltaPct"]["p50"]
            await bus.emit("agent.thinking", {"stepEl": f"Καλύτερη παραλλαγή: {b_hot:+.1f}°C, {b_corr:+.1f}% χρόνος διαδρομής"})
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


def describe_result(sim: dict) -> str:
    """Τι λέει η ATHENA για ένα αποτέλεσμα: πρόσημο και εύρος όπως ήρθαν από τον sim."""
    tt = sim["traffic"]["corridorTravelTimeDeltaPct"]
    hot = sim["thermal"]["hotspotDeltaC"]
    parts = []
    if tt["p10"] == tt["p50"] == tt["p90"] == 0:
        parts.append("η κυκλοφορία δεν αλλάζει")
    else:
        verb = "αυξάνεται" if tt["p50"] > 0 else "μειώνεται"
        parts.append(f"ο χρόνος διαδρομής {verb} περίπου {abs(tt['p50']):.1f}% "
                     f"(εύρος {tt['p10']:+.1f} έως {tt['p90']:+.1f}%)")
    if hot["p10"] == hot["p50"] == hot["p90"] == 0:
        parts.append("η θερμοκρασία δεν αλλάζει")
    else:
        verb = "πέφτει" if hot["p50"] < 0 else "ανεβαίνει"
        parts.append(f"η θερμοκρασία επιφάνειας στο σημείο {verb} περίπου {abs(hot['p50']):.1f}°C "
                     f"(εύρος {hot['p10']:+.1f} έως {hot['p90']:+.1f}°C)")
    return "Εκτιμώ ότι " + " και ".join(parts) + "."


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


# ── POST /consult ──────────────────────────────────────────────────────────

@app.post("/consult", response_model=ConsultResponse)
async def consult(req: ConsultRequest):
    """
    ENGAGE beat (3:00–4:00): δημιουργεί before/after + ανοίγει διαβούλευση με QR.
    Broadcasts: consultation.opened → agent.say
    """
    t0 = time.perf_counter()
    log.info("consult: scenarioId=%s reportId=%s", req.scenarioId, req.reportId)

    # Before/after images
    before_url, after_url = await render_before_after(req.photoUrl or "", req.scenarioTitle)

    # Άνοιγμα διαβούλευσης στον gateway
    consultation = await open_consultation(
        scenario_id=req.scenarioId,
        report_id=req.reportId,
        before_url=before_url,
        after_url=after_url,
    )

    # Event sequence
    from agent.mock import engage_sequence
    n = 0
    for event_type, payload in engage_sequence(before_url, after_url, consultation):
        if event_type == "agent.say":
            from agent.tts import synthesize
            audio_url = await synthesize(payload["textEl"], GATEWAY_URL)
            if audio_url:
                payload = {**payload, "audioUrl": audio_url}
        await bus.emit(event_type, payload)
        n += 1

    log.info("consult done in %.1fs", time.perf_counter() - t0)
    return ConsultResponse(
        consultationId=consultation.get("id", "c-mock"),
        publicUrl=consultation.get("publicUrl", f"{GATEWAY_URL}/c/mock"),
        eventsQueued=n,
    )


# ── POST /decision ─────────────────────────────────────────────────────────

@app.post("/decision", response_model=DecisionResponse)
async def decision(req: DecisionRequest):
    """
    DECISION beat (4:00–4:30): γεννάει DecisionDraft και κάνει broadcast decision.ready.
    Broadcasts: agent.thinking × 2 → decision.ready → agent.say
    """
    t0 = time.perf_counter()
    log.info("decision: scenarioId=%s", req.scenarioId)

    sim_result = req.simResult or {}
    draft = await draft_decision(
        scenario_id=req.scenarioId,
        scenario_title=req.scenarioTitle,
        sim_result=sim_result,
        consultation_id=req.consultationId,
        vote_summary=req.voteSummary,
    )

    from agent.mock import decision_sequence
    n = 0
    for event_type, payload in decision_sequence(draft):
        if event_type == "agent.say":
            from agent.tts import synthesize
            audio_url = await synthesize(payload["textEl"], GATEWAY_URL)
            if audio_url:
                payload = {**payload, "audioUrl": audio_url}
        await bus.emit(event_type, payload)
        n += 1

    log.info("decision done in %.1fs", time.perf_counter() - t0)
    return DecisionResponse(markdownEl=draft["markdownEl"], eventsQueued=n)


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
    if (photo_url or req.imageBase64) and not MOCK:
        try:
            if req.imageBase64:
                import base64
                photo_bytes = base64.b64decode(req.imageBase64)
            else:
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
