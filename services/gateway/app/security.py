"""Ό,τι έρχεται από το tunnel (κινητά κοινού) βλέπει μόνο τα δημόσια endpoints.

Τα requests μέσω Cloudflare Tunnel / Vercel / reverse proxy κουβαλάνε headers όπως
cf-connecting-ip ή x-forwarded-for. Τα τοπικά (web, agent, sim, director) όχι.
Έτσι κανείς από την αίθουσα δεν μπορεί να στείλει events στην οθόνη ή να πατήσει reset.
"""

from __future__ import annotations

import re
import time
import uuid

from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.types import ASGIApp, Receive, Scope, Send

PROXY_HEADERS = (b"cf-connecting-ip", b"cf-ray", b"x-forwarded-for", b"x-real-ip")

PUBLIC_HTTP = [
    ("GET", re.compile(r"^/$")),
    ("GET", re.compile(r"^/c(/.*)?$")),
    ("GET", re.compile(r"^/media/.+")),
    ("GET", re.compile(r"^/api/consultations/[^/]+$")),
    ("GET", re.compile(r"^/api/consultations/[^/]+/tally$")),
    ("POST", re.compile(r"^/api/consultations/[^/]+/votes$")),
    ("POST", re.compile(r"^/api/reports$")),
    ("GET", re.compile(r"^/api/reports/[^/]+$")),
]


def is_proxied(scope: Scope) -> bool:
    return any(name in PROXY_HEADERS for name, _ in scope.get("headers", []))


def public_allowed(method: str, path: str) -> bool:
    if method == "HEAD":
        method = "GET"
    return any(m == method and rx.match(path) for m, rx in PUBLIC_HTTP)


def ws_room(scope: Scope) -> str:
    from urllib.parse import parse_qs

    qs = parse_qs(scope.get("query_string", b"").decode())
    return (qs.get("room") or ["screen"])[0]


class PublicGuard:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] in ("http", "websocket") and is_proxied(scope):
            if scope["type"] == "http" and scope["method"] != "OPTIONS":
                if not public_allowed(scope["method"], scope["path"]):
                    resp = JSONResponse({"detail": "Δεν επιτρέπεται από δημόσιο δίκτυο"}, status_code=403)
                    await resp(scope, receive, send)
                    return
            if scope["type"] == "websocket" and not ws_room(scope).startswith("citizen:"):
                await send({"type": "websocket.close", "code": 4403})
                return
        await self.app(scope, receive, send)


# ---------- device id (1 ψήφος ανά συσκευή) ----------
COOKIE = "athena_did"
_DID_RX = re.compile(r"^[A-Za-z0-9_-]{8,64}$")


def device_id(request: Request) -> tuple[str, bool]:
    """(id, νέο;) — cookie πρώτα, μετά header X-Device-Id (localStorage του citizen app)."""
    for cand in (request.cookies.get(COOKIE), request.headers.get("x-device-id")):
        if cand and _DID_RX.match(cand):
            return cand, False
    return uuid.uuid4().hex, True


def set_device_cookie(request: Request, response: Response, did: str) -> None:
    secure = (
        request.url.scheme == "https"
        or request.headers.get("x-forwarded-proto") == "https"
        or ("https" in request.headers.get("cf-visitor", ""))
    )
    response.set_cookie(COOKIE, did, max_age=60 * 60 * 24 * 30, httponly=True, samesite="lax", secure=secure)


def client_key(request: Request) -> str:
    return request.headers.get("cf-connecting-ip") or (request.client.host if request.client else "?")


class RateLimiter:
    """Ελάχιστο διάστημα ανάμεσα σε δύο ενέργειες του ίδιου κλειδιού."""

    def __init__(self, min_interval_s: float):
        self.min_interval_s = min_interval_s
        self.last: dict[str, float] = {}

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        if now - self.last.get(key, -1e9) < self.min_interval_s:
            return False
        self.last[key] = now
        if len(self.last) > 20_000:
            cutoff = now - 3600
            self.last = {k: t for k, t in self.last.items() if t > cutoff}
        return True
