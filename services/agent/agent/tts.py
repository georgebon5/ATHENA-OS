"""
Text-to-Speech. MOCK=1: επιστρέφει None (το web δείχνει μόνο υπότιτλους).
MOCK=0: ElevenLabs (ή OpenAI TTS ως fallback).

Στόχος: < 1.5s TTFB για φράσεις έως 20 λέξεις.
Caching για γνωστές φράσεις (intro, μεταβάσεις).
"""
from __future__ import annotations

import hashlib
import logging
from pathlib import Path

from .constants import MOCK, TTS_API_KEY, TTS_PROVIDER, TTS_VOICE_ID, DEMO_CACHE_DIR

log = logging.getLogger("athena.tts")

# Φάκελος για cache ήχου
_AUDIO_CACHE = DEMO_CACHE_DIR / "tts"
_AUDIO_CACHE.mkdir(parents=True, exist_ok=True)


def _cache_key(text: str) -> str:
    return hashlib.md5(text.encode(), usedforsecurity=False).hexdigest()


async def synthesize(text_el: str, gateway_base: str = "") -> str | None:
    """
    Επιστρέφει URL του audio ή None αν δεν έχει TTS.
    gateway_base: π.χ. "http://localhost:8000" για να φτιάξει public URL.
    """
    if MOCK or not TTS_API_KEY:
        return None

    # Έλεγξε cache πρώτα
    key = _cache_key(text_el)
    cached = _AUDIO_CACHE / f"{key}.mp3"
    if cached.exists():
        return f"{gateway_base}/media/tts/{key}.mp3"

    if TTS_PROVIDER == "elevenlabs":
        return await _elevenlabs(text_el, cached, gateway_base, key)
    elif TTS_PROVIDER == "openai":
        return await _openai_tts(text_el, cached, gateway_base, key)
    else:
        log.warning("Άγνωστος TTS provider: %s", TTS_PROVIDER)
        return None


async def _elevenlabs(text_el: str, path: Path, base: str, key: str) -> str | None:
    try:
        import httpx
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.post(
                f"https://api.elevenlabs.io/v1/text-to-speech/{TTS_VOICE_ID}/stream",
                headers={"xi-api-key": TTS_API_KEY, "Content-Type": "application/json"},
                json={
                    "text": text_el,
                    "model_id": "eleven_multilingual_v2",
                    "voice_settings": {"stability": 0.5, "similarity_boost": 0.8},
                },
            )
            if resp.status_code == 200:
                path.write_bytes(resp.content)
                return f"{base}/media/tts/{key}.mp3"
            log.warning("ElevenLabs error %s: %s", resp.status_code, resp.text[:200])
    except Exception as e:  # noqa: BLE001
        log.warning("ElevenLabs failed: %s", e)
    return None


async def _openai_tts(text_el: str, path: Path, base: str, key: str) -> str | None:
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=TTS_API_KEY)
        response = await client.audio.speech.create(
            model="tts-1", voice="nova", input=text_el, response_format="mp3"
        )
        path.write_bytes(response.content)
        return f"{base}/media/tts/{key}.mp3"
    except Exception as e:  # noqa: BLE001
        log.warning("OpenAI TTS failed: %s", e)
    return None
