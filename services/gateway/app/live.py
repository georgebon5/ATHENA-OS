"""Live δεδομένα πόλης: λεωφορεία ΟΑΣΑ (live / replay / mock) και θερμοκρασία (Open-Meteo).

ΟΑΣΑ telematics (δοκιμάστηκε 18/11/2026):
  getClosestStops&p1={lat}&p2={lng}  → στάσεις κοντά στο σημείο
  webRoutesForStop&p1={StopCode}     → διαδρομές (RouteCode, LineID)
  getBusLocation&p1={RouteCode}      → οχήματα (VEH_NO, CS_LAT, CS_LNG, CS_DATE, VEH_HEADING)
Μόνο το https:// απαντά· το http:// κάνει timeout.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import TYPE_CHECKING, Any

import httpx

from .config import BBOX, SERAFIO

if TYPE_CHECKING:
    from .context import AppContext

log = logging.getLogger("athena.live")

# Σημεία από όπου ανακαλύπτουμε γραμμές: Πειραιώς (Σεράφειο, Γκάζι), Θησείο, Κεραμεικός
PROBE_POINTS = [(37.9787, 23.7108), (37.9760, 23.7075), (37.9805, 23.7140), (37.9770, 23.7200), (37.9830, 23.7180)]
PAD = 0.003  # μικρό περιθώριο γύρω από το bbox
STALE_AFTER = timedelta(minutes=5)
LIVE_FAILS_BEFORE_FALLBACK = 3
LIVE_RETRY_S = 60
PIRAIOS = [
    (23.7050, 37.9740),
    (23.7065, 37.9755),
    (23.7080, 37.9770),
    (23.7108, 37.9787),
    (23.7130, 37.9800),
    (23.7155, 37.9815),
]


def in_bbox(lng: float, lat: float) -> bool:
    return BBOX[0] - PAD <= lng <= BBOX[2] + PAD and BBOX[1] - PAD <= lat <= BBOX[3] + PAD


class OasaPoller:
    def __init__(self, ctx: AppContext):
        self.ctx = ctx
        s = ctx.settings
        self.mode = s.oasa_mode  # ό,τι ζητήθηκε
        self.source = "mock" if self.mode == "mock" else ("down" if self.mode == "off" else self.mode)
        self.buses: list[dict[str, Any]] = []
        self.routes: dict[str, str] = {}  # RouteCode → LineID
        self.fails = 0
        self.last_live_try = float("-inf")
        self.cache_dir = s.demo_dir / "cache" / "oasa"
        self._replay_frames: list[dict[str, Any]] = []
        self._replay_i = 0
        self._mock_t = 0

    # ---------- κύριος βρόχος ----------
    async def run(self) -> None:
        if self.mode == "off":
            return
        while True:
            started = time.monotonic()
            try:
                await self.tick()
            except Exception:  # noqa: BLE001 — ο poller δεν πρέπει να πεθάνει ποτέ
                log.exception("OASA tick failed")
            await asyncio.sleep(max(1.0, self.ctx.settings.oasa_interval_s - (time.monotonic() - started)))

    async def tick(self) -> None:
        buses: list[dict[str, Any]] | None = None
        want_live = self.mode == "live" and (
            self.source == "live" or time.monotonic() - self.last_live_try > LIVE_RETRY_S
        )
        if want_live:
            self.last_live_try = time.monotonic()
            buses = await self._poll_live()
            if buses is not None:
                if self.source != "live":
                    log.info("ΟΑΣΑ: επιστροφή σε live")
                    self._set_source("live")
                self.fails = 0
            else:
                self.fails += 1
                if self.source == "live" and self.fails >= LIVE_FAILS_BEFORE_FALLBACK:
                    self._set_source("replay" if self._load_replay() else "mock")
                    self.ctx.status.fallback(f"ΟΑΣΑ εκτός λειτουργίας → {self.source}")
        if buses is None and self.source == "live":
            return  # προσωρινή αποτυχία: κρατάμε τα τελευταία λεωφορεία
        if buses is None and self.source == "replay":
            buses = self._next_replay()
            if buses is None:
                self._set_source("mock")
        if buses is None and self.source == "mock":
            buses = self._mock_frame()
        if buses is None:
            return
        self.buses = buses
        self.ctx.publish("buses.update", {"buses": buses})
        if self.ctx.settings.oasa_record and self.source == "live":
            self._record(buses)

    def _set_source(self, source: str) -> None:
        self.source = source
        self.ctx.status.broadcast()

    # ---------- live ----------
    async def _get(self, act: str, *params: Any) -> Any:
        q = {"act": act} | {f"p{i + 1}": p for i, p in enumerate(params)}
        r = await self.ctx.http.get(self.ctx.settings.oasa_base_url, params=q, timeout=8.0)
        r.raise_for_status()
        return r.json()

    async def discover_routes(self) -> dict[str, str]:
        routes_file = self.cache_dir / "routes.json"
        routes: dict[str, str] = {}
        try:
            for lat, lng in PROBE_POINTS:
                for stop in (await self._get("getClosestStops", lat, lng) or [])[:4]:
                    for rt in await self._get("webRoutesForStop", stop["StopCode"]) or []:
                        routes[str(rt["RouteCode"])] = str(rt.get("LineID") or rt.get("LineCode"))
        except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
            log.warning("ΟΑΣΑ discovery απέτυχε: %s", exc)
        if routes:
            self.cache_dir.mkdir(parents=True, exist_ok=True)
            routes_file.write_text(json.dumps(routes, ensure_ascii=False, indent=1), encoding="utf-8")
        elif routes_file.exists():
            routes = json.loads(routes_file.read_text(encoding="utf-8"))
        return routes

    async def _poll_live(self) -> list[dict[str, Any]] | None:
        if not self.routes:
            self.routes = await self.discover_routes()
            if not self.routes:
                return None
            log.info("ΟΑΣΑ: %d διαδρομές περνούν από το bbox", len(self.routes))
        sem = asyncio.Semaphore(6)

        async def one(route_code: str) -> list[dict[str, Any]] | None:
            async with sem:
                try:
                    return await self._get("getBusLocation", route_code) or []
                except (httpx.HTTPError, ValueError):
                    return None

        results = await asyncio.gather(*(one(rc) for rc in self.routes))
        if all(r is None for r in results):
            return None
        now = datetime.now()
        seen: dict[str, dict[str, Any]] = {}
        for rc, vehicles in zip(self.routes, results, strict=True):
            for v in vehicles or []:
                try:
                    lng, lat = float(v["CS_LNG"]), float(v["CS_LAT"])
                    ts = datetime.strptime(v["CS_DATE"][:19], "%Y-%m-%d %H:%M:%S")
                except (KeyError, ValueError, TypeError):
                    continue
                if not in_bbox(lng, lat) or now - ts > STALE_AFTER:
                    continue
                seen[str(v["VEH_NO"])] = {
                    "id": str(v["VEH_NO"]),
                    "line": self.routes[rc],
                    "lngLat": [round(lng, 6), round(lat, 6)],
                    "bearing": float(v.get("VEH_HEADING") or 0) % 360,
                }
        return sorted(seen.values(), key=lambda b: b["id"])

    # ---------- recorder / replay ----------
    def _record(self, buses: list[dict[str, Any]]) -> None:
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        path = self.cache_dir / f"recording-{datetime.now():%Y%m%d}.jsonl"
        with path.open("a", encoding="utf-8") as f:
            f.write(json.dumps({"t": round(time.time(), 1), "buses": buses}, ensure_ascii=False) + "\n")

    def _load_replay(self) -> bool:
        files = sorted(self.cache_dir.glob("recording-*.jsonl"))
        if not files:
            return False
        frames = []
        for line in files[-1].read_text(encoding="utf-8").splitlines():
            try:
                frames.append(json.loads(line))
            except ValueError:
                continue
        self._replay_frames = [f for f in frames if f.get("buses")]
        self._replay_i = 0
        log.info("ΟΑΣΑ replay: %s (%d frames)", files[-1].name, len(self._replay_frames))
        return bool(self._replay_frames)

    def _next_replay(self) -> list[dict[str, Any]] | None:
        if not self._replay_frames and not self._load_replay():
            return None
        frame = self._replay_frames[self._replay_i % len(self._replay_frames)]
        self._replay_i += 1
        return frame["buses"]

    # ---------- mock ----------
    def _mock_frame(self) -> list[dict[str, Any]]:
        self._mock_t += 1
        out = []
        for i, bus in enumerate(self.ctx.fixture("buses.json")):
            f = ((self._mock_t * 0.04) + i / 7) % 1.0
            forward = bus["bearing"] < 180
            pos = f if forward else 1 - f
            seg = min(int(pos * (len(PIRAIOS) - 1)), len(PIRAIOS) - 2)
            t = pos * (len(PIRAIOS) - 1) - seg
            (a, b), (c, d) = PIRAIOS[seg], PIRAIOS[seg + 1]
            out.append({**bus, "lngLat": [round(a + (c - a) * t, 6), round(b + (d - b) * t, 6)]})
        return out

    def summary(self) -> dict[str, Any]:
        return {
            "active": len(self.buses),
            "lines": sorted({b["line"] for b in self.buses}),
            "source": self.source,
        }


class WeatherCache:
    TTL_S = 600

    def __init__(self, ctx: AppContext):
        self.ctx = ctx
        self.value: dict[str, Any] = {"temperatureC": None, "apparentC": None, "source": "open-meteo"}
        self.fetched_at = float("-inf")  # όχι 0: το monotonic ενός φρέσκου container είναι μικρό

    async def get(self) -> dict[str, Any]:
        if self.ctx.settings.mock:
            return self.ctx.fixture("city_live.json")["weather"]
        if time.monotonic() - self.fetched_at > self.TTL_S:
            try:
                r = await self.ctx.http.get(
                    "https://api.open-meteo.com/v1/forecast",
                    params={
                        "latitude": SERAFIO[1],
                        "longitude": SERAFIO[0],
                        "current": "temperature_2m,apparent_temperature",
                    },
                    timeout=4.0,
                )
                r.raise_for_status()
                cur = r.json()["current"]
                self.value = {
                    "temperatureC": cur["temperature_2m"],
                    "apparentC": cur["apparent_temperature"],
                    "source": "open-meteo",
                }
                self.fetched_at = time.monotonic()
            except (httpx.HTTPError, KeyError, ValueError) as exc:
                log.warning("Open-Meteo: %s (κρατάμε την τελευταία τιμή)", exc)
                self.fetched_at = time.monotonic() - self.TTL_S + 60  # ξαναδοκίμασε σε 1'
        return self.value


def recording_files(cache_dir: Path) -> list[Path]:
    return sorted(cache_dir.glob("recording-*.jsonl"))
