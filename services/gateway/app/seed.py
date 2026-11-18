"""Ιστορικές αναφορές στο bbox, ώστε η πόλη να μη φαίνεται άδεια στο INTRO.

Φωτογραφίες: αν υπάρχουν πραγματικές στο demo/seed/photos/<category>/*.jpg χρησιμοποιούνται αυτές
(βγάλτε μερικές στο Γκάζι την Παρασκευή!). Αλλιώς φτιάχνεται placeholder κάρτα ανά κατηγορία.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import delete, func, select

from . import db as tables
from . import media

if TYPE_CHECKING:
    from .context import AppContext

log = logging.getLogger("athena.seed")


def _shift(created: str, delta) -> str:  # type: ignore[no-untyped-def]
    dt = datetime.strptime(created, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=UTC) + delta
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


async def seed_reports(ctx: AppContext, force: bool = False) -> int:
    async with ctx.db.engine.connect() as conn:
        n = (
            await conn.execute(select(func.count()).select_from(tables.reports).where(tables.reports.c.seeded))
        ).scalar_one()
    if n and not force:
        return 0
    items = ctx.fixture("reports_seed.json")
    # Οι χρόνοι του fixture είναι σχετικοί με το 21/11 10:00· τους φέρνουμε στο «τώρα».
    newest = max(datetime.strptime(i["createdAt"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=UTC) for i in items)
    delta = datetime.now(UTC).replace(microsecond=0) - newest
    photos_root = ctx.demo_path("seed", "photos")
    real: dict[str, list] = {}
    if photos_root.exists():
        for folder in photos_root.iterdir():
            if folder.is_dir():
                real[folder.name] = sorted(p for p in folder.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png"})

    rows = []
    for i, item in enumerate(items):
        cat = item["classification"]["category"]
        pool = real.get(cat) or []
        if pool:
            data = await asyncio.to_thread(media.process_photo, pool[i % len(pool)].read_bytes())
        else:
            data = await asyncio.to_thread(media.placeholder_photo, cat, i)
        path = media.save(ctx.settings.media_dir, "seed", f"{item['id']}.jpg", data)
        rows.append(
            {
                "id": item["id"],
                "created_at": _shift(item["createdAt"], delta),
                "photo_url": path,
                "lng": item["location"][0],
                "lat": item["location"][1],
                "heading": item["heading"],
                "accuracy_m": item["accuracyM"],
                "classification": item["classification"],
                "hidden": False,
                "seeded": True,
                "device_id": None,
            }
        )
    async with ctx.db.engine.begin() as conn:
        await conn.execute(delete(tables.reports).where(tables.reports.c.seeded))
        await conn.execute(tables.reports.insert(), rows)
    log.info(
        "seed: %d ιστορικές αναφορές (%d με πραγματική φωτογραφία)",
        len(rows),
        sum(bool(real.get(r["classification"]["category"])) for r in rows),
    )
    return len(rows)
