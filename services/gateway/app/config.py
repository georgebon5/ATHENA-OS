from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

REPO_ROOT = Path(os.environ.get("ATHENA_ROOT") or Path(__file__).resolve().parents[3])

# Περιοχή του demo (CLAUDE.md §5.4): Πειραιώς / Γκάζι / Κεραμεικός / Θησείο
BBOX = (23.700, 37.970, 23.730, 37.990)
SERAFIO = (23.7108, 37.9787)  # Πειραιώς 144


def _bool(name: str, default: bool = False) -> bool:
    return os.environ.get(name, "1" if default else "0").strip().lower() in {"1", "true", "yes", "on"}


@dataclass
class Settings:
    mock: bool = False
    # Βάση για τα URLs των media που πάνε στο web/agent (το laptop του demo)
    gateway_url: str = "http://localhost:8000"
    # Βάση του citizen app για το QR. Τα κινητά μπαίνουν από εδώ (tunnel).
    public_citizen_url: str = "http://localhost:8000/c"
    database_url: str = ""
    db_wait_s: float = 8.0  # πόσο περιμένουμε την Postgres πριν πέσουμε σε SQLite
    sim_url: str = "http://localhost:8100"
    agent_url: str = "http://localhost:8200"
    oasa_base_url: str = "https://telematics.oasa.gr/api/"
    oasa_mode: str = "live"  # live | replay | mock | off
    oasa_record: bool = False
    oasa_interval_s: float = 10.0
    sim_timeout_s: float = 8.0
    agent_timeout_s: float = 20.0
    tally_interval_s: float = 0.5
    seed_on_start: bool = True
    var_dir: Path = field(default_factory=lambda: REPO_ROOT / "services" / "gateway" / "var")
    fixtures_dir: Path = field(default_factory=lambda: REPO_ROOT / "packages" / "contracts" / "fixtures")
    demo_dir: Path = field(default_factory=lambda: REPO_ROOT / "demo")
    citizen_dist: Path = field(default_factory=lambda: REPO_ROOT / "apps" / "citizen" / "dist")
    web_cache_dir: Path = field(default_factory=lambda: REPO_ROOT / "apps" / "web" / "public" / "demo" / "cache")

    @property
    def media_dir(self) -> Path:
        return self.var_dir / "media"

    @property
    def sqlite_url(self) -> str:
        return f"sqlite+aiosqlite:///{(self.var_dir / 'athena.db').as_posix()}"

    @classmethod
    def from_env(cls) -> Settings:
        gateway_url = os.environ.get("GATEWAY_URL", "http://localhost:8000").rstrip("/")
        s = cls(
            mock=_bool("MOCK"),
            gateway_url=gateway_url,
            public_citizen_url=os.environ.get("PUBLIC_CITIZEN_URL", "").rstrip("/") or f"{gateway_url}/c",
            database_url=os.environ.get("DATABASE_URL", ""),
            db_wait_s=float(os.environ.get("DB_CONNECT_WAIT_S", "8")),
            sim_url=os.environ.get("SIM_URL", "http://localhost:8100").rstrip("/"),
            agent_url=os.environ.get("AGENT_URL", "http://localhost:8200").rstrip("/"),
            oasa_base_url=os.environ.get("OASA_BASE_URL", "https://telematics.oasa.gr/api/"),
            oasa_mode=os.environ.get("OASA_MODE", "live").strip().lower(),
            oasa_record=_bool("OASA_RECORD"),
            seed_on_start=_bool("SEED_ON_START", True),
        )
        if "<" in s.public_citizen_url:  # placeholder του .env.example
            s.public_citizen_url = f"{gateway_url}/c"
        if s.mock and s.oasa_mode == "live":
            s.oasa_mode = "mock"
        if var := os.environ.get("GATEWAY_VAR_DIR"):
            s.var_dir = Path(var)
        return s
