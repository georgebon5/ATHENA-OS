"""Κοινή κατάσταση του gateway (ένα instance ανά process)."""

from __future__ import annotations

import json
import logging
from collections import deque
from datetime import UTC, datetime
from functools import lru_cache
from pathlib import Path
from typing import Any

import httpx
from athena_contracts import EVENT_PAYLOADS
from pydantic import ValidationError
from sqlalchemy import update

from . import db as tables
from .config import Settings
from .db import Database
from .hub import Hub

log = logging.getLogger("athena")


def now_iso() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


class ContractError(ValueError):
    pass


def validate_event(event_type: str, payload: Any) -> None:
    model = EVENT_PAYLOADS.get(event_type)
    if model is None:
        raise ContractError(f"Άγνωστο event type: {event_type!r}")
    try:
        model.model_validate(payload)
    except ValidationError as exc:
        raise ContractError(f"{event_type}: {exc.errors(include_url=False)[:3]}") from exc


class Status:
    """Κατάσταση υπηρεσιών + πρόσφατα fallbacks. Φαίνεται ΜΟΝΟ στον director (system.status)."""

    def __init__(self, ctx: AppContext):
        self.ctx = ctx
        mock = "mock" if ctx.settings.mock else "down"
        self.services: dict[str, str] = {"sim": mock, "agent": mock}
        self.fallbacks: deque[str] = deque(maxlen=12)

    def snapshot(self) -> dict[str, Any]:
        return {
            "at": now_iso(),
            "services": {
                "db": self.ctx.db.kind if self.ctx.db else "sqlite",
                "sim": self.services["sim"],
                "agent": self.services["agent"],
                "oasa": self.ctx.oasa.source if self.ctx.oasa else "down",
            },
            "fallbacks": list(self.fallbacks),
        }

    def fallback(self, message_el: str) -> None:
        log.warning("FALLBACK: %s", message_el)
        self.fallbacks.appendleft(f"{datetime.now().strftime('%H:%M:%S')} {message_el}")
        self.broadcast()

    def set_service(self, name: str, state: str) -> None:
        if self.services.get(name) != state:
            self.services[name] = state
            self.broadcast()

    def broadcast(self) -> None:
        self.ctx.hub.publish("system.status", self.snapshot())


class AppContext:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.hub = Hub()
        self.db: Database = None  # type: ignore[assignment]  # γεμίζει στο lifespan
        self.http: httpx.AsyncClient = None  # type: ignore[assignment]
        self.oasa = None  # OasaPoller
        self.weather = None  # WeatherCache
        self.tallies = None  # Tallies
        self.status = Status(self)
        self.started_at = datetime.now(UTC)

    # ---------- fixtures / demo cache ----------
    @lru_cache(maxsize=64)  # noqa: B019 — ένα context ανά process
    def _fixture_raw(self, name: str) -> str:
        return (self.settings.fixtures_dir / name).read_text(encoding="utf-8")

    def fixture(self, name: str) -> Any:
        """Νέο αντίγραφο κάθε φορά (ο caller μπορεί να το αλλάξει)."""
        return json.loads(self._fixture_raw(name))

    def demo_path(self, *parts: str) -> Path:
        return self.settings.demo_dir.joinpath(*parts)

    # ---------- URLs ----------
    def abs_url(self, url: str) -> str:
        """/media/... → http://localhost:8000/media/... (για web/agent). Εξωτερικά URLs μένουν ως έχουν."""
        return self.settings.gateway_url + url if url.startswith("/") else url

    def public_url(self, url: str) -> str:
        """Για τα κινητά (tunnel): τα δικά μας media γίνονται relative, ώστε να φορτώνουν από το ίδιο origin."""
        base = self.settings.gateway_url
        return url[len(base) :] if url.startswith(base + "/") else url

    # ---------- events ----------
    def publish(self, event_type: str, payload: Any) -> dict[str, Any]:
        return self.hub.publish(event_type, payload)

    async def ingest(self, event_type: str, payload: Any, *, persist: bool = True) -> dict[str, Any]:
        """Event από agent/director: έλεγχος contract → παρενέργειες στη βάση → broadcast."""
        validate_event(event_type, payload)
        if persist and event_type == "report.classified" and payload.get("classification"):
            async with self.db.engine.begin() as conn:
                await conn.execute(
                    update(tables.reports)
                    .where(tables.reports.c.id == payload["id"])
                    .values(classification=payload["classification"])
                )
        elif persist and event_type == "report.hidden":
            async with self.db.engine.begin() as conn:
                await conn.execute(
                    update(tables.reports).where(tables.reports.c.id == payload["id"]).values(hidden=True)
                )
        return self.publish(event_type, payload)
