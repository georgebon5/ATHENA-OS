"""ATHENA OS gateway — `uvicorn app.main:app --port 8000` (ΕΝΑΣ worker: το pub/sub είναι in-process)."""

from __future__ import annotations

import asyncio
import contextlib
import logging
import re
import sys
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse, Response

from .config import Settings
from .context import AppContext, ContractError
from .db import Database
from .hub import FULL_ROOMS
from .live import OasaPoller, WeatherCache
from .media import MediaFiles
from .routes import director, engage, reports, scenarios
from .routes.engage import public_url_for, save_consultation
from .routes.reports import visible_reports
from .security import PublicGuard
from .seed import seed_reports
from .tally import Tallies

log = logging.getLogger("athena")
ROOM_RX = re.compile(r"^(screen|director|agent|citizen:[A-Za-z0-9_-]{1,64})$")


def _setup_logging() -> None:
    for stream in (sys.stdout, sys.stderr):
        if (getattr(stream, "encoding", "") or "").lower().replace("-", "") != "utf8":
            with contextlib.suppress(Exception):
                stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)-7s %(name)s: %(message)s", datefmt="%H:%M:%S"
    )
    logging.getLogger("httpx").setLevel(logging.WARNING)


async def monitor_services(ctx: AppContext) -> None:
    """Κάθε 5 s: είναι ζωντανοί ο sim και ο agent; Αλλαγές → system.status στον director."""
    if ctx.settings.mock:
        return
    while True:
        for name, base in (("sim", ctx.settings.sim_url), ("agent", ctx.settings.agent_url)):
            try:
                await ctx.http.get(f"{base}/health", timeout=1.5)
                ctx.status.set_service(name, "up")
            except httpx.TimeoutException:
                pass  # απασχολημένος (π.χ. ο sim υπολογίζει): δεν τον δηλώνουμε κάτω
            except httpx.HTTPError:
                ctx.status.set_service(name, "down")
        await asyncio.sleep(5)


async def _mock_consultation(ctx: AppContext) -> None:
    """Στο MOCK η διαβούλευση του fixture υπάρχει πάντα, για να δοκιμάζεται το /c/v/c-demo-001."""
    c = ctx.fixture("consultation.json")
    c["publicUrl"] = public_url_for(ctx, c["id"])
    await save_consultation(ctx, c)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    ctx = AppContext(settings)
    settings.media_dir.mkdir(parents=True, exist_ok=True)

    @asynccontextmanager
    async def lifespan(app: FastAPI):  # type: ignore[no-untyped-def]
        ctx.db = await Database.connect(settings.database_url, settings.sqlite_url, settings.db_wait_s)
        ctx.http = httpx.AsyncClient(headers={"User-Agent": "athena-os-gateway/0.1"}, follow_redirects=True)
        ctx.oasa = OasaPoller(ctx)
        ctx.weather = WeatherCache(ctx)
        ctx.tallies = Tallies(ctx)
        if settings.mock:
            await _mock_consultation(ctx)
        if settings.seed_on_start:
            try:
                await seed_reports(ctx)
            except Exception:  # noqa: BLE001 — το seed δεν πρέπει να ρίξει την εκκίνηση
                log.exception("seed failed")
        tasks = [
            asyncio.create_task(ctx.oasa.run(), name="oasa"),
            asyncio.create_task(ctx.tallies.run(), name="tally"),
            asyncio.create_task(monitor_services(ctx), name="monitor"),
        ]
        log.info(
            "gateway έτοιμος · MOCK=%s · DB=%s · ΟΑΣΑ=%s · citizen=%s",
            int(settings.mock),
            ctx.db.kind,
            ctx.oasa.source,
            settings.public_citizen_url,
        )
        try:
            yield
        finally:
            for t in tasks:
                t.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)
            await ctx.http.aclose()
            await ctx.db.engine.dispose()

    app = FastAPI(title="ATHENA OS gateway", version="0.1.0", lifespan=lifespan)
    app.state.ctx = ctx
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Athena-Source"],
    )
    app.add_middleware(PublicGuard)
    for module in (reports, scenarios, engage, director):
        app.include_router(module.router)
    app.mount("/media", MediaFiles(directory=settings.media_dir), name="media")

    @app.websocket("/ws")
    async def ws_endpoint(ws: WebSocket, room: str = "screen") -> None:
        if not ROOM_RX.match(room):
            await ws.close(code=4400)
            return
        await ws.accept()
        reports_now = await visible_reports(ctx) if room in FULL_ROOMS else []
        replay = ctx.hub.replay_events(room, reports_now)
        if room == "director":
            replay.append({"type": "system.status", "payload": ctx.status.snapshot(), "replay": True})

        async def on_message(client, msg):  # type: ignore[no-untyped-def]
            if client.room not in ("agent", "director"):
                return None
            if "type" not in msg or "payload" not in msg:
                return {"type": "error", "payload": {"detail": "Αναμένεται { type, payload }"}}
            try:
                await ctx.ingest(msg["type"], msg["payload"])
            except ContractError as exc:
                return {"type": "error", "payload": {"detail": str(exc)}}
            return None

        await ctx.hub.serve(ws, room, replay, on_message)

    # ---------- citizen app (build του apps/citizen) στο /c ----------
    dist = settings.citizen_dist

    @app.get("/", include_in_schema=False)
    async def root() -> RedirectResponse:
        return RedirectResponse("/c/")

    @app.get("/c", include_in_schema=False)
    async def citizen_root() -> RedirectResponse:
        return RedirectResponse("/c/")

    @app.get("/c/{path:path}", include_in_schema=False)
    async def citizen(path: str) -> Response:
        index = dist / "index.html"
        if not index.exists():
            return HTMLResponse(
                "<h1>Το citizen app δεν έχει γίνει build</h1><p><code>pnpm --filter @athena-os/citizen build</code></p>",
                status_code=503,
            )
        if path:
            target = (dist / path).resolve()
            if target.is_file() and _inside(target, dist):
                immutable = path.startswith("assets/")
                cache = "public, max-age=31536000, immutable" if immutable else "public, max-age=300"
                return FileResponse(target, headers={"Cache-Control": cache})
        return FileResponse(index, headers={"Cache-Control": "no-cache"})

    return app


def _inside(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root.resolve())
        return True
    except ValueError:
        return False


_setup_logging()
app = create_app()
