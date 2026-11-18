"""Αποθήκευση: Postgres+PostGIS, με αυτόματο fallback σε SQLite αν η Postgres δεν απαντά."""

from __future__ import annotations

import asyncio
import logging
import math
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    Float,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

log = logging.getLogger("athena.db")

metadata = MetaData()

reports = Table(
    "reports",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("created_at", String(40), nullable=False, index=True),  # ISO UTC «...Z»: ταξινομείται λεξικογραφικά
    Column("photo_url", Text, nullable=False),
    Column("lng", Float, nullable=False),
    Column("lat", Float, nullable=False),
    Column("heading", Float),
    Column("accuracy_m", Float),
    Column("classification", JSON),
    Column("hidden", Boolean, nullable=False, default=False),
    Column("seeded", Boolean, nullable=False, default=False),
    Column("device_id", String(64)),
)

scenarios = Table(
    "scenarios",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("hash", String(32), nullable=False, index=True),
    Column("data", JSON, nullable=False),
    Column("created_at", String(40), nullable=False),
)

# Cache αποτελεσμάτων sim ανά hash σεναρίου (edits + when). Δεν σβήνεται στο reset.
sim_results = Table(
    "sim_results",
    metadata,
    Column("hash", String(32), primary_key=True),
    Column("result", JSON, nullable=False),
    Column("created_at", String(40), nullable=False),
)

consultations = Table(
    "consultations",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("data", JSON, nullable=False),
    Column("created_at", String(40), nullable=False),
)

votes = Table(
    "votes",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("consultation_id", String(64), nullable=False, index=True),
    Column("device_id", String(64), nullable=False),
    Column("choice", String(8), nullable=False),
    Column("lng", Float),
    Column("lat", Float),
    Column("comment", Text),
    Column("created_at", String(40), nullable=False),
    UniqueConstraint("consultation_id", "device_id", name="uq_vote_device"),
)

POSTGIS_DDL = [
    "CREATE EXTENSION IF NOT EXISTS postgis",
    "ALTER TABLE reports ADD COLUMN IF NOT EXISTS geog geography(Point, 4326) "
    "GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) STORED",
    "CREATE INDEX IF NOT EXISTS reports_geog_idx ON reports USING GIST (geog)",
]


class Database:
    def __init__(self, engine: AsyncEngine, kind: str, postgis: bool):
        self.engine = engine
        self.kind = kind  # "postgres" | "sqlite"
        self.postgis = postgis

    @classmethod
    async def connect(cls, url: str, sqlite_url: str, wait_s: float = 8.0) -> Database:
        """Postgres αν απαντήσει μέσα σε wait_s (π.χ. ενώ ξεκινά το container), αλλιώς SQLite."""
        if url.startswith(("postgresql://", "postgres://")):
            pg_url = "postgresql+asyncpg://" + url.split("://", 1)[1]
            engine = create_async_engine(pg_url, pool_size=10, max_overflow=10, pool_pre_ping=True)
            deadline = asyncio.get_running_loop().time() + wait_s
            while True:
                try:
                    async with asyncio.timeout(4):
                        async with engine.begin() as conn:
                            await conn.run_sync(metadata.create_all)
                    postgis = await cls._setup_postgis(engine)
                    log.info("DB: Postgres (PostGIS=%s)", postgis)
                    return cls(engine, "postgres", postgis)
                except Exception as exc:  # noqa: BLE001 — οποιοδήποτε σφάλμα → retry, μετά fallback
                    if asyncio.get_running_loop().time() < deadline:
                        await asyncio.sleep(1)
                        continue
                    log.warning("Postgres μη διαθέσιμη (%s: %s) → fallback σε SQLite", exc.__class__.__name__, exc)
                    await engine.dispose()
                    break
        engine = create_async_engine(sqlite_url, connect_args={"timeout": 15})
        async with engine.begin() as conn:
            await conn.exec_driver_sql("PRAGMA journal_mode=WAL")
            await conn.run_sync(metadata.create_all)
        log.info("DB: SQLite (%s)", sqlite_url)
        return cls(engine, "sqlite", False)

    @staticmethod
    async def _setup_postgis(engine: AsyncEngine) -> bool:
        try:
            async with engine.begin() as conn:
                for ddl in POSTGIS_DDL:
                    await conn.execute(text(ddl))
            return True
        except Exception as exc:  # noqa: BLE001
            log.warning("PostGIS setup απέτυχε (%s) — οι χωρικές αναζητήσεις γίνονται σε Python", exc)
            return False

    async def nearby_reports(
        self, report_id: str, lng: float, lat: float, radius_m: float = 50
    ) -> list[dict[str, Any]]:
        """Αναφορές σε ακτίνα radius_m (για να βρει ο agent duplicates)."""
        async with self.engine.connect() as conn:
            if self.postgis:
                rows = await conn.execute(
                    text(
                        "SELECT id, classification, ST_Distance(geog, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography) AS d "
                        "FROM reports WHERE id <> :id AND NOT hidden "
                        "AND ST_DWithin(geog, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :r) "
                        "ORDER BY d LIMIT 10"
                    ),
                    {"id": report_id, "lng": lng, "lat": lat, "r": radius_m},
                )
                found = [(r.id, r.classification, float(r.d)) for r in rows]
            else:
                dlat = radius_m / 111_320
                dlng = dlat / max(0.1, math.cos(math.radians(lat)))
                rows = await conn.execute(
                    reports.select().where(
                        reports.c.id != report_id,
                        reports.c.hidden.is_(False),
                        reports.c.lng.between(lng - dlng, lng + dlng),
                        reports.c.lat.between(lat - dlat, lat + dlat),
                    )
                )
                found = []
                for r in rows:
                    d = haversine_m(lng, lat, r.lng, r.lat)
                    if d <= radius_m:
                        found.append((r.id, r.classification, d))
                found.sort(key=lambda x: x[2])
                found = found[:10]
        out = []
        for rid, cls, d in found:
            item: dict[str, Any] = {"id": rid, "distanceM": round(d, 1)}
            if cls and cls.get("category"):
                item["category"] = cls["category"]
            out.append(item)
        return out


def haversine_m(lng1: float, lat1: float, lng2: float, lat2: float) -> float:
    r = 6_371_000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))
