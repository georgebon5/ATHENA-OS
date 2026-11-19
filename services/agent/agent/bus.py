"""
WebSocket event bus: ο agent συνδέεται στο gateway ως room=agent και στέλνει events.
Αν το gateway δεν είναι διαθέσιμο, τα events αποθηκεύονται σε ουρά και
ξαναστέλνονται αυτόματα όταν αποκατασταθεί η σύνδεση.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

import websockets
from websockets.exceptions import ConnectionClosed

from .constants import GATEWAY_WS

log = logging.getLogger("athena.bus")


class EventBus:
    def __init__(self) -> None:
        self._queue: asyncio.Queue[str] = asyncio.Queue(maxsize=512)
        self._task: asyncio.Task | None = None
        self._connected = False

    # ── Lifecycle ──────────────────────────────────────────────────────────

    async def start(self) -> None:
        self._task = asyncio.create_task(self._run(), name="agent-event-bus")

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()

    # ── Public API ─────────────────────────────────────────────────────────

    async def emit(self, event_type: str, payload: Any) -> None:
        """Στέλνει event στο gateway (fire-and-forget, δεν αποκλείει)."""
        text = json.dumps({"type": event_type, "payload": payload}, ensure_ascii=False, separators=(",", ":"))
        try:
            self._queue.put_nowait(text)
        except asyncio.QueueFull:
            log.warning("bus queue full — dropping %s", event_type)

    async def emit_sequence(self, events: list[tuple[str, Any]], gap_s: float = 0.4) -> None:
        """Στέλνει σειρά events με χρονική καθυστέρηση μεταξύ τους."""
        for event_type, payload in events:
            await self.emit(event_type, payload)
            if gap_s > 0:
                await asyncio.sleep(gap_s)

    @property
    def connected(self) -> bool:
        return self._connected

    # ── Internal ───────────────────────────────────────────────────────────

    async def _run(self) -> None:
        """Βρόχος επανασύνδεσης."""
        while True:
            try:
                async with websockets.connect(GATEWAY_WS, ping_interval=20, ping_timeout=10) as ws:
                    self._connected = True
                    log.info("EventBus: συνδέθηκε στο gateway (%s)", GATEWAY_WS)
                    while True:
                        text = await self._queue.get()
                        await ws.send(text)
            except ConnectionClosed:
                self._connected = False
                log.warning("EventBus: gateway έκλεισε — επανασύνδεση σε 2s")
            except OSError as e:
                self._connected = False
                log.warning("EventBus: δεν βρέθηκε gateway (%s) — επανάληψη σε 3s", e)
                await asyncio.sleep(1)  # extra wait for OSError
            except Exception as e:  # noqa: BLE001
                self._connected = False
                log.warning("EventBus: %s — επανάληψη σε 2s", e)
            await asyncio.sleep(2)


# Singleton — δημιουργείται στο lifespan του main.py
bus: EventBus = EventBus()
