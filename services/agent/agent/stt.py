"""
Speech-to-Text. MOCK=1: επιστρέφει hardcoded εντολή demo.
MOCK=0: OpenAI Whisper (excellent Greek support).
"""
from __future__ import annotations

import logging

from .constants import MOCK, STT_API_KEY

log = logging.getLogger("athena.stt")

MOCK_TRANSCRIPT = "βάλε λωρίδα λεωφορείου και σαράντα δέντρα στην Πειραιώς"


async def transcribe(audio_bytes: bytes, mime_type: str = "audio/webm") -> str:
    if MOCK or not STT_API_KEY:
        log.info("STT mock → '%s'", MOCK_TRANSCRIPT)
        return MOCK_TRANSCRIPT

    try:
        from openai import AsyncOpenAI
        import io
        client = AsyncOpenAI(api_key=STT_API_KEY)
        ext = mime_type.split("/")[-1].split(";")[0] or "webm"
        result = await client.audio.transcriptions.create(
            model="whisper-1",
            file=(f"audio.{ext}", io.BytesIO(audio_bytes), mime_type),
            language="el",
            response_format="text",
        )
        transcript = result.strip()
        log.info("STT: '%s'", transcript)
        return transcript
    except Exception as e:  # noqa: BLE001
        log.warning("STT failed: %s — χρήση mock transcript", e)
        return MOCK_TRANSCRIPT
