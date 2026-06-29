"""Tests for the analytics endpoint (issue #10)."""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models.base import Role, Tenant, User

TENANT = Tenant(id=uuid.uuid4(), name="VC Fund", slug="vc-fund")
ANALYST = User(
    id=uuid.uuid4(),
    tenant_id=TENANT.id,
    clerk_user_id="user_a10",
    email="a@vc.com",
    role=Role.analyst,
)


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.anyio
async def test_analytics_requires_auth():
    async with _client() as c:
        resp = await c.get("/analytics")
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_analytics_returns_correct_shape():
    mock_stage_row = MagicMock()
    mock_stage_row.stage = MagicMock()
    mock_stage_row.stage.value = "inbox"
    mock_stage_row.cnt = 5

    mock_dim_row = MagicMock()
    mock_dim_row.dimension_key = "team"
    mock_dim_row.avg_ai = 3.5
    mock_dim_row.avg_human = None
    mock_dim_row.deal_count = 5

    call_count = 0

    def _execute(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        result = MagicMock()
        if call_count == 1:
            result.all.return_value = [mock_stage_row]
        elif call_count == 2:
            # dwell time query
            result.all.return_value = []
        elif call_count == 3:
            result.all.return_value = [mock_dim_row]
        else:
            # weekly invested
            result.all.return_value = []
        return result

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=_execute)

    async with _client() as c:
        with (
            patch("app.api.deps.get_current_user", return_value=ANALYST),
            patch("app.core.database.get_db", return_value=mock_db),
        ):
            resp = await c.get("/analytics")

    assert resp.status_code == 200
    data = resp.json()
    assert "total_deals" in data
    assert "by_stage" in data
    assert "scorecard_averages" in data
    assert "dwell_time" in data
    assert "weekly_invested" in data
    assert data["total_deals"] == 5
    assert data["by_stage"][0]["stage"] == "inbox"


@pytest.mark.anyio
async def test_analytics_pass_rate_none_when_no_terminal_deals():
    mock_stage_row = MagicMock()
    mock_stage_row.stage = MagicMock()
    mock_stage_row.stage.value = "screening"
    mock_stage_row.cnt = 3

    call_count = 0

    def _execute(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        result = MagicMock()
        if call_count == 1:
            result.all.return_value = [mock_stage_row]
        else:
            result.all.return_value = []
        return result

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=_execute)

    async with _client() as c:
        with (
            patch("app.api.deps.get_current_user", return_value=ANALYST),
            patch("app.core.database.get_db", return_value=mock_db),
        ):
            resp = await c.get("/analytics")

    assert resp.status_code == 200
    assert resp.json()["pass_rate"] is None
