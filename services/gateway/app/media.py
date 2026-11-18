"""Φωτογραφίες και media: resize, strip EXIF, αποθήκευση σε δίσκο, static serving."""

from __future__ import annotations

import io
import uuid
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps
from starlette.staticfiles import StaticFiles
from starlette.types import Receive, Scope, Send

Image.MAX_IMAGE_PIXELS = 60_000_000  # προστασία από decompression bombs
MAX_PHOTO_PX = 1600

ALLOWED_UPLOADS = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "audio/mpeg": ".mp3",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/ogg": ".ogg",
    "audio/webm": ".webm",
}


class BadImage(ValueError):
    pass


def process_photo(data: bytes, max_px: int = MAX_PHOTO_PX) -> bytes:
    """Resize σε ≤1600px, εφαρμογή του EXIF orientation στα pixels, και καμία άλλη μεταδεδομένη πληροφορία
    (GPS, μοντέλο κινητού κ.λπ.) στο αρχείο που σερβίρουμε."""
    try:
        img = Image.open(io.BytesIO(data))
        img = ImageOps.exif_transpose(img)
        img = img.convert("RGB")
    except Exception as exc:  # noqa: BLE001
        raise BadImage(str(exc)) from exc
    img.thumbnail((max_px, max_px), Image.Resampling.LANCZOS)
    out = io.BytesIO()
    img.save(out, "JPEG", quality=84, optimize=True, progressive=True)
    return out.getvalue()


def save(media_dir: Path, sub: str, name: str, data: bytes) -> str:
    """Γράφει το αρχείο και επιστρέφει το path του URL (/media/sub/name)."""
    folder = media_dir / sub
    folder.mkdir(parents=True, exist_ok=True)
    tmp = folder / f".{name}.{uuid.uuid4().hex}.tmp"
    tmp.write_bytes(data)
    tmp.replace(folder / name)
    return f"/media/{sub}/{name}"


class MediaFiles(StaticFiles):
    """Τα ονόματα είναι μοναδικά (uuid) και δεν αλλάζουν ποτέ → μακρύ, immutable cache."""

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        async def send_with_cache(message):  # type: ignore[no-untyped-def]
            if message["type"] == "http.response.start" and message.get("status") == 200:
                headers = list(message.get("headers", []))
                headers.append((b"cache-control", b"public, max-age=31536000, immutable"))
                message = {**message, "headers": headers}
            await send(message)

        await super().__call__(scope, receive, send_with_cache)


# ---------- placeholder για τις ιστορικές αναφορές χωρίς πραγματική φωτογραφία ----------
CATEGORY_STYLE = {
    "pothole": ("Λακκούβα", (92, 74, 60)),
    "sidewalk_damage": ("Φθορά πεζοδρομίου", (110, 96, 84)),
    "waste": ("Απορρίμματα", (70, 98, 64)),
    "lighting": ("Φωτισμός", (60, 70, 110)),
    "obstruction": ("Εμπόδιο", (120, 84, 52)),
    "heat_exposure": ("Θερμική έκθεση", (168, 70, 46)),
    "graffiti": ("Graffiti", (104, 62, 112)),
    "accessibility": ("Προσβασιμότητα", (46, 104, 140)),
    "other": ("Άλλο", (80, 88, 96)),
}
FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
]


def _font(size: int) -> ImageFont.ImageFont | ImageFont.FreeTypeFont:
    for path in FONT_CANDIDATES:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default(size=size)


def placeholder_photo(category: str, seed: int) -> bytes:
    label, (r, g, b) = CATEGORY_STYLE.get(category, CATEGORY_STYLE["other"])
    w, h = 960, 720
    img = Image.new("RGB", (w, h))
    draw = ImageDraw.Draw(img)
    for y in range(h):  # κάθετο gradient
        k = 0.55 + 0.45 * (y / h)
        draw.line([(0, y), (w, y)], fill=(int(r * k), int(g * k), int(b * k)))
    # «υφή» δρόμου: διαγώνιες γραμμές με σταθερό seed
    for i in range(14):
        x = (seed * 37 + i * 97) % w
        draw.line([(x, 0), (x - 260, h)], fill=(int(r * 1.15) % 256, int(g * 1.15) % 256, int(b * 1.15) % 256), width=3)
    draw.rectangle([0, h - 150, w, h], fill=(6, 9, 13))
    draw.text((40, h - 128), label, font=_font(56), fill=(232, 237, 242))
    draw.text((40, h - 56), "Αρχείο αναφορών · ATHENA Sense", font=_font(26), fill=(123, 209, 255))
    out = io.BytesIO()
    img.save(out, "JPEG", quality=80, optimize=True)
    return out.getvalue()
