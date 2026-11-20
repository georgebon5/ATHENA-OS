from __future__ import annotations
import os
from pathlib import Path

MOCK = os.getenv("MOCK", "1").strip() in {"1", "true", "yes"}
PORT = int(os.getenv("PORT", "8200"))
GATEWAY_URL = os.getenv("GATEWAY_URL", "http://localhost:8000")
GATEWAY_WS = GATEWAY_URL.replace("http://", "ws://").replace("https://", "wss://") + "/ws?room=agent"

LLM_API_KEY      = os.getenv("LLM_API_KEY", "")
LLM_MODEL        = os.getenv("LLM_MODEL", "claude-opus-4-6")
STT_API_KEY      = os.getenv("STT_API_KEY", "")
TTS_API_KEY      = os.getenv("TTS_API_KEY", "")
TTS_PROVIDER     = os.getenv("TTS_PROVIDER", "elevenlabs")
TTS_VOICE_ID     = os.getenv("TTS_VOICE_ID", "")
IMAGE_EDIT_API_KEY = os.getenv("IMAGE_EDIT_API_KEY", "")

def _find_repo_root() -> Path:
    """Walk up from this file looking for CLAUDE.md (repo root marker)."""
    here = Path(__file__).resolve()
    for parent in here.parents:
        if (parent / "CLAUDE.md").exists():
            return parent
    return here.parents[1]  # fallback: /app in Docker

REPO_ROOT    = Path(os.getenv("REPO_ROOT",    str(_find_repo_root())))
FIXTURES_DIR = Path(os.getenv("FIXTURES_DIR", str(REPO_ROOT / "packages" / "contracts" / "fixtures")))
DEMO_CACHE_DIR = Path(os.getenv("DEMO_CACHE_DIR", str(REPO_ROOT / "demo" / "cache")))

# Σεράφειο — πρωταρχικό σημείο demo
SERAFIO_LNGLAT = (23.7108, 37.9787)

# Βασικές λήψεις κάμερας (ονόματα που ξέρει ο web)
CAMERA_SHOTS = {
    "orbitSerafio": {"lngLat": SERAFIO_LNGLAT, "heightM": 220, "headingDeg": 0,   "pitchDeg": -35, "durationS": 4},
    "riseToOverview": {"lngLat": SERAFIO_LNGLAT, "heightM": 800, "headingDeg": 0,   "pitchDeg": -55, "durationS": 5},
    "streetLevel":    {"lngLat": SERAFIO_LNGLAT, "heightM": 30,  "headingDeg": 15,  "pitchDeg": -15, "durationS": 3},
    "corridor":       {"lngLat": (23.7120, 37.9764), "heightM": 350, "headingDeg": 350, "pitchDeg": -45, "durationS": 4},
}

# Agents tool call timeout
TOOL_TIMEOUT_S = 10.0
# Μέγιστα βήματα ανά agent loop
MAX_LOOP_STEPS = 6
