from __future__ import annotations

import io
import time
from collections.abc import Callable, Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.config import Settings
from app.main import create_app


def make_settings(tmp_path: Path, **over: Any) -> Settings:
    s = Settings(
        mock=True,
        gateway_url="http://localhost:8000",
        public_citizen_url="https://athena.example/c",
        database_url="",
        sim_url="http://127.0.0.1:9",  # κλειστή πόρτα: «ο sim είναι κάτω»
        agent_url="http://127.0.0.1:9",
        oasa_mode="off",
        seed_on_start=False,
        tally_interval_s=0.05,
    )
    s.var_dir = tmp_path / "var"
    s.demo_dir = tmp_path / "demo"
    s.citizen_dist = tmp_path / "citizen-dist"
    s.web_cache_dir = tmp_path / "web-cache"
    for k, v in over.items():
        setattr(s, k, v)
    return s


@pytest.fixture
def make_client(tmp_path: Path) -> Iterator[Callable[..., TestClient]]:
    clients: list[TestClient] = []

    def factory(**over: Any) -> TestClient:
        c = TestClient(create_app(make_settings(tmp_path, **over)))
        c.__enter__()
        clients.append(c)
        return c

    yield factory
    for c in clients:
        c.__exit__(None, None, None)


@pytest.fixture
def client(make_client: Callable[..., TestClient]) -> TestClient:
    return make_client()


def jpeg_bytes(w: int = 3000, h: int = 2000, orientation: int | None = 6) -> bytes:
    """JPEG από «κινητό»: μεγάλο, με EXIF orientation και GPS."""
    img = Image.new("RGB", (w, h), (200, 80, 40))
    exif = Image.Exif()
    if orientation:
        exif[0x0112] = orientation
    exif[0x0110] = "Phone Model X"  # Model
    buf = io.BytesIO()
    img.save(buf, "JPEG", exif=exif)
    return buf.getvalue()


def receive_until(ws: Any, predicate: Callable[[dict[str, Any]], bool], limit: int = 200) -> dict[str, Any]:
    for _ in range(limit):
        msg = ws.receive_json()
        if predicate(msg):
            return msg
    raise AssertionError("δεν ήρθε το αναμενόμενο μήνυμα")


def wait_for(fn: Callable[[], bool], timeout: float = 5.0) -> None:
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        if fn():
            return
        time.sleep(0.05)
    raise AssertionError("timeout")
