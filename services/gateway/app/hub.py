"""WebSocket hub: in-process pub/sub με rooms, heartbeat και replay κατάστασης σε νέο client.

Rooms:
  screen          η κεντρική οθόνη (default)       — παίρνει όλα τα events
  director        το director panel                  — όλα τα events
  agent           ο agent (μπορεί και να στέλνει)    — όλα τα events
  citizen:{cid}   κινητό σε διαβούλευση              — μόνο vote.tally της διαβούλευσης cid

Κάθε client έχει δική του ουρά αποστολής, ώστε ένα αργό κινητό να μην καθυστερεί την οθόνη.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
from collections.abc import Iterable
from typing import Any

from starlette.websockets import WebSocket, WebSocketDisconnect

log = logging.getLogger("athena.hub")

FULL_ROOMS = {"screen", "director", "agent"}
QUEUE_MAX = 256

# Events που κρατάμε ως «τρέχουσα κατάσταση» για replay. layer.set κρατιέται ανά layer.
SLOT_TYPES = {
    "director.beat",
    "time.set",
    "buses.update",
    "scenario.created",
    "sim.result",
    "variant.compare",
    "consultation.opened",
    "vote.tally",
    "decision.ready",
    "camera.flyTo",
}
REPLAY_HEAD = ["director.beat", "time.set", "buses.update"]
REPLAY_TAIL = [
    "scenario.created",
    "sim.result",
    "variant.compare",
    "consultation.opened",
    "vote.tally",
    "decision.ready",
]


def envelope(event_type: str, payload: Any, replay: bool = False) -> dict[str, Any]:
    ev: dict[str, Any] = {"type": event_type, "payload": payload}
    if replay:
        ev["replay"] = True
    return ev


def dumps(ev: dict[str, Any]) -> str:
    return json.dumps(ev, ensure_ascii=False, separators=(",", ":"))


def room_wants(room: str, ev: dict[str, Any]) -> bool:
    if room in FULL_ROOMS:
        return True
    if room.startswith("citizen:"):
        cid = room.split(":", 1)[1]
        return ev["type"] == "vote.tally" and ev["payload"].get("consultationId") == cid
    return False


class Client:
    def __init__(self, ws: WebSocket, room: str):
        self.ws = ws
        self.room = room
        self.queue: asyncio.Queue[str | None] = asyncio.Queue(maxsize=QUEUE_MAX)
        self.alive = True

    def wants(self, ev: dict[str, Any]) -> bool:
        return room_wants(self.room, ev)

    def offer(self, text: str) -> None:
        try:
            self.queue.put_nowait(text)
        except asyncio.QueueFull:
            # Ο client δεν προλαβαίνει: τον κόβουμε. Θα κάνει reconnect και θα πάρει replay.
            self.alive = False
            with contextlib.suppress(asyncio.QueueFull):
                self.queue.get_nowait()
                self.queue.put_nowait(None)


class Hub:
    def __init__(self) -> None:
        self.clients: set[Client] = set()
        self.slots: dict[str, dict[str, Any]] = {}

    # ---------- publish ----------
    def publish(self, event_type: str, payload: Any) -> dict[str, Any]:
        ev = envelope(event_type, payload)
        self._remember(ev)
        text = dumps(ev)
        for client in list(self.clients):
            if client.alive and client.wants(ev):
                client.offer(text)
        return ev

    def _remember(self, ev: dict[str, Any]) -> None:
        t, p = ev["type"], ev["payload"]
        if t == "state.reset":
            self.slots.clear()
            return
        if t == "layer.set":
            self.slots[f"layer:{p['layer']}"] = ev
            return
        if t not in SLOT_TYPES:
            return
        if t == "scenario.created":
            for k in ("sim.result", "variant.compare"):
                self.slots.pop(k, None)
        elif t == "consultation.opened":
            self.slots.pop("vote.tally", None)
        self.slots[t] = ev

    def clear(self) -> None:
        self.slots.clear()

    # ---------- replay ----------
    def replay_events(self, room: str, reports: Iterable[dict[str, Any]] = ()) -> list[dict[str, Any]]:
        if room.startswith("citizen:"):
            ev = self.slots.get("vote.tally")
            return [envelope(ev["type"], ev["payload"], replay=True)] if ev and room_wants(room, ev) else []
        out: list[dict[str, Any]] = []

        def add(key: str) -> None:
            if ev := self.slots.get(key):
                out.append(envelope(ev["type"], ev["payload"], replay=True))

        for key in REPLAY_HEAD:
            add(key)
        for key in sorted(k for k in self.slots if k.startswith("layer:")):
            add(key)
        for r in reports:
            out.append(envelope("report.classified" if r.get("classification") else "report.created", r, replay=True))
        for key in REPLAY_TAIL:
            add(key)
        if cam := self.slots.get("camera.flyTo"):
            out.append(envelope("camera.flyTo", {**cam["payload"], "durationS": 0}, replay=True))
        return out

    # ---------- connection ----------
    def rooms(self) -> dict[str, int]:
        counts: dict[str, int] = {}
        for c in self.clients:
            key = "citizen" if c.room.startswith("citizen:") else c.room
            counts[key] = counts.get(key, 0) + 1
        return counts

    async def serve(self, ws: WebSocket, room: str, replay: list[dict[str, Any]], on_message) -> None:
        """Τρέχει μέχρι να κλείσει η σύνδεση. on_message(client, msg) για ό,τι δεν είναι ping."""
        client = Client(ws, room)
        for ev in replay:
            client.offer(dumps(ev))
        self.clients.add(client)
        writer = asyncio.create_task(self._writer(client))
        try:
            while client.alive:
                raw = await ws.receive_text()
                try:
                    msg = json.loads(raw)
                except ValueError:
                    continue
                if not isinstance(msg, dict):
                    continue
                if msg.get("type") == "ping":
                    client.offer('{"type":"pong"}')
                    continue
                reply = await on_message(client, msg)
                if reply is not None:
                    client.offer(dumps(reply))
        except (WebSocketDisconnect, RuntimeError):
            pass
        finally:
            client.alive = False
            self.clients.discard(client)
            with contextlib.suppress(asyncio.QueueFull):
                client.queue.put_nowait(None)
            writer.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await writer

    @staticmethod
    async def _writer(client: Client) -> None:
        try:
            while True:
                text = await client.queue.get()
                if text is None or not client.alive:
                    break
                await asyncio.wait_for(client.ws.send_text(text), timeout=10)
        except Exception:  # noqa: BLE001 — κλειστό socket / timeout
            pass
        finally:
            client.alive = False
            with contextlib.suppress(Exception):
                await client.ws.close()
