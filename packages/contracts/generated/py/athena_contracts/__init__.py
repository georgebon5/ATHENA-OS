"""Contracts του ATHENA OS ως Pydantic v2 models.

    from athena_contracts import Report, SimResult, EVENT_PAYLOADS

Τα models παράγονται στο models.py (μην το αλλάζεις με το χέρι). Εδώ μόνο βοηθήματα.
"""

from typing import get_args

from pydantic import BaseModel

from . import models
from .models import *  # noqa: F403


def _event_payloads() -> dict[str, type[BaseModel]]:
    """type του WS event → Pydantic model του payload, π.χ. "sim.result" → SimResult."""
    out: dict[str, type[BaseModel]] = {}
    for variant in get_args(models.WsEvent.model_fields["root"].annotation):
        (event_type,) = get_args(variant.model_fields["type"].annotation)
        out[event_type] = variant.model_fields["payload"].annotation
    return out


EVENT_PAYLOADS: dict[str, type[BaseModel]] = _event_payloads()
