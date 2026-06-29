"""Tests for the engagement event ingestion endpoint (issue #11)."""

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models.base import DealStage, Role, Tenant, User

TENANT = Tenant(id=uuid.uuid4(), name="VC Fund", slug="vc-fund")
ANALYST = User(
    id=uuid.uuid4(),
    tenant_id=TENANT.id,
    clerk_user_id="user_eng1",
    email="eng@vc.com",
    role=Role.analyst,
)
DEAL_ID = uuid.uuid4()
DEAL = MagicMock()
DEAL.id = DEAL_ID
DEAL.tenant_id = TENANT.id
DEAL.stage = DealStage.screening


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


def _event(event_type="section_dwell", section="scorecard", value=12.5):
    return {
        "event_type": event_type,
        "section": section,
        "value": value,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@pytest.mark.anyio
async def test_engagement_requires_auth():
    async with _client() as c:
        resp = await c.post("/events/engagement", json={"deal_id": str(DEAL_ID), "events": []})
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_engagement_stores_events():
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=DEAL)
    mock_db.add = MagicMock()
    mock_db.commit = AsyncMock()

    payload = {
        "deal_id": str(DEAL_ID),
        "events": [
            _event("section_dwell", "scorecard", 15.3),
            _event("memo_copied", "memo", None),
            _event("dd_question_clicked", "dd_questions", 2),
        ],
    }

    async with _client() as c:
        with (
            patch("app.api.deps.get_current_user", return_value=ANALYST),
            patch("app.core.database.get_db", return_value=mock_db),
        ):
            resp = await c.post("/events/engagement", json=payload)

    assert resp.status_code == 204
    assert mock_db.add.call_count == 3


@pytest.mark.anyio
async def test_engagement_unknown_event_types_are_dropped():
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=DEAL)
    mock_db.add = MagicMock()
    mock_db.commit = AsyncMock()

    payload = {
        "deal_id": str(DEAL_ID),
        "events": [
            _event("section_dwell", "scorecard", 5.0),
            _event("unknown_event", "scorecard", 1.0),
        ],
    }

    async with _client() as c:
        with (
            patch("app.api.deps.get_current_user", return_value=ANALYST),
            patch("app.core.database.get_db", return_value=mock_db),
        ):
            resp = await c.post("/events/engagement", json=payload)

    assert resp.status_code == 204
    assert mock_db.add.call_count == 1  # only the valid event stored


@pytest.mark.anyio
async def test_engagement_wrong_tenant_returns_404():
    other_deal = MagicMock()
    other_deal.id = DEAL_ID
    other_deal.tenant_id = uuid.uuid4()  # different tenant

    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=other_deal)

    payload = {"deal_id": str(DEAL_ID), "events": [_event()]}

    async with _client() as c:
        with (
            patch("app.api.deps.get_current_user", return_value=ANALYST),
            patch("app.core.database.get_db", return_value=mock_db),
        ):
            resp = await c.post("/events/engagement", json=payload)

    assert resp.status_code == 404
