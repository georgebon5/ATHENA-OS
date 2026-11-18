from __future__ import annotations

import asyncio
from collections.abc import Coroutine
from typing import Any

from starlette.requests import HTTPConnection

from ..context import AppContext

_background: set[asyncio.Task[Any]] = set()


def get_ctx(conn: HTTPConnection) -> AppContext:
    return conn.app.state.ctx


def spawn(coro: Coroutine[Any, Any, Any]) -> asyncio.Task[Any]:
    """Fire-and-forget task που δεν το μαζεύει ο garbage collector στη μέση."""
    task = asyncio.create_task(coro)
    _background.add(task)
    task.add_done_callback(_background.discard)
    return task
