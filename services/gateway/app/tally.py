"""Ψήφοι: μία ανά συσκευή ανά διαβούλευση (νέα ψήφος = αλλαγή γνώμης), throttled vote.tally κάθε ~500 ms."""

from __future__ import annotations

import asyncio
import hashlib
import logging
from typing import TYPE_CHECKING, Any

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from . import db as tables

if TYPE_CHECKING:
    from .context import AppContext

log = logging.getLogger("athena.votes")


def _jitter(device_id: str) -> tuple[float, float]:
    """Σταθερή μικρή μετατόπιση (≤ ~60 m) ώστε οι ψήφοι της ίδιας γειτονιάς να μη στοιβάζονται σε ένα pixel."""
    h = hashlib.sha1(device_id.encode()).digest()
    return ((h[0] / 255 - 0.5) * 0.0012, (h[1] / 255 - 0.5) * 0.0009)


class Tallies:
    def __init__(self, ctx: AppContext):
        self.ctx = ctx
        # consultation id → device id → (choice, lng, lat)
        self.votes: dict[str, dict[str, tuple[str, float | None, float | None]]] = {}
        self.dirty: set[str] = set()
        self.known: set[str] = set()  # διαβουλεύσεις που ξέρουμε ότι υπάρχουν (γλιτώνει ένα SELECT ανά ψήφο)
        self._locks: dict[str, asyncio.Lock] = {}

    async def _ensure_loaded(self, cid: str) -> dict[str, tuple[str, float | None, float | None]]:
        if cid in self.votes:
            return self.votes[cid]
        lock = self._locks.setdefault(cid, asyncio.Lock())
        async with lock:
            if cid not in self.votes:
                async with self.ctx.db.engine.connect() as conn:
                    rows = await conn.execute(select(tables.votes).where(tables.votes.c.consultation_id == cid))
                    self.votes[cid] = {r.device_id: (r.choice, r.lng, r.lat) for r in rows}
        return self.votes[cid]

    async def cast(
        self, cid: str, device_id: str, choice: str, location: list[float] | None, comment: str | None, now: str
    ) -> None:
        lng, lat = (location[0], location[1]) if location else (None, None)
        values = {
            "consultation_id": cid,
            "device_id": device_id,
            "choice": choice,
            "lng": lng,
            "lat": lat,
            "comment": (comment or "").strip()[:500] or None,
            "created_at": now,
        }
        insert = pg_insert if self.ctx.db.kind == "postgres" else sqlite_insert
        stmt = insert(tables.votes).values(**values)
        stmt = stmt.on_conflict_do_update(
            index_elements=["consultation_id", "device_id"],
            set_={k: stmt.excluded[k] for k in ("choice", "lng", "lat", "comment", "created_at")},
        )
        async with self.ctx.db.engine.begin() as conn:
            await conn.execute(stmt)
        (await self._ensure_loaded(cid))[device_id] = (choice, lng, lat)
        self.dirty.add(cid)

    async def tally(self, cid: str) -> dict[str, Any]:
        votes = await self._ensure_loaded(cid)
        counts = {"yes": 0, "no": 0, "maybe": 0}
        points = []
        for did, (choice, lng, lat) in votes.items():
            counts[choice] = counts.get(choice, 0) + 1
            if lng is not None and lat is not None:
                jx, jy = _jitter(did)
                points.append({"lngLat": [round(lng + jx, 6), round(lat + jy, 6)], "choice": choice})
        return {"consultationId": cid, **counts, "points": points}

    def reset(self) -> None:
        self.votes.clear()
        self.dirty.clear()
        self.known.clear()

    async def run(self) -> None:
        while True:
            await asyncio.sleep(self.ctx.settings.tally_interval_s)
            if not self.dirty:
                continue
            pending, self.dirty = self.dirty, set()
            for cid in pending:
                try:
                    self.ctx.publish("vote.tally", await self.tally(cid))
                except Exception:  # noqa: BLE001
                    log.exception("tally broadcast failed")
