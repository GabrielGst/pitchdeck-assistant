"""Shared test helpers."""
from collections.abc import AsyncGenerator
from contextlib import contextmanager
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.main import app


@contextmanager
def mock_user(user: Any):
    """Override get_current_user to return *user* without hitting Clerk."""
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        yield user
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@contextmanager
def mock_db_session(session: Any):
    """Override get_db to yield *session* instead of a real DB connection."""
    async def _fake_db() -> AsyncGenerator[AsyncSession, None]:
        yield session

    app.dependency_overrides[get_db] = _fake_db
    try:
        yield session
    finally:
        app.dependency_overrides.pop(get_db, None)
