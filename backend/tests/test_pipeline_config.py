"""Tests for pipeline stage configuration (issue #12)."""

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models.base import Role, Tenant, User
from app.models.pipeline import TenantConfig
from tests.conftest import mock_db_session, mock_user

TENANT = Tenant(id=uuid.uuid4(), name="VC Fund", slug="vc-fund")
ADMIN = User(
    id=uuid.uuid4(), tenant_id=TENANT.id, clerk_user_id="user_pc_admin",
    email="admin@vc.com", role=Role.admin,
)
ANALYST = User(
    id=uuid.uuid4(), tenant_id=TENANT.id, clerk_user_id="user_pc_analyst",
    email="an@vc.com", role=Role.analyst,
)


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


def _cfg(labels=None, custom=None):
    cfg = MagicMock(spec=TenantConfig)
    cfg.tenant_id = TENANT.id
    cfg.stage_labels = labels or {}
    cfg.custom_stages = custom or []
    return cfg


@pytest.mark.anyio
async def test_get_pipeline_config_requires_auth():
    async with _client() as c:
        resp = await c.get("/pipeline-config")
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_get_pipeline_config_returns_defaults():
    mock_db = AsyncMock()
    execute_result = MagicMock()
    execute_result.scalar_one_or_none.return_value = _cfg()
    mock_db.execute = AsyncMock(return_value=execute_result)

    async with _client() as c:
        with (
            mock_user(ANALYST),
            mock_db_session(mock_db),
        ):
            resp = await c.get("/pipeline-config")

    assert resp.status_code == 200
    data = resp.json()
    assert "stage_order" in data
    assert "stage_labels" in data
    assert "inbox" in data["stage_labels"]
    assert data["stage_labels"]["inbox"] == "Inbox"
    assert data["custom_stages"] == []


@pytest.mark.anyio
async def test_put_pipeline_config_non_admin_forbidden():
    mock_db = AsyncMock()

    async with _client() as c:
        with (
            mock_user(ANALYST),
            mock_db_session(mock_db),
        ):
            resp = await c.put("/pipeline-config", json={"stage_labels": {}, "custom_stages": []})

    assert resp.status_code == 403


@pytest.mark.anyio
async def test_put_pipeline_config_admin_saves():
    cfg = _cfg()
    mock_db = AsyncMock()
    execute_result = MagicMock()
    execute_result.scalar_one_or_none.return_value = cfg
    mock_db.execute = AsyncMock(return_value=execute_result)
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    payload = {
        "stage_labels": {"inbox": "New Deals", "screening": "First Look"},
        "custom_stages": [{"key": "ic_prep", "label": "IC Prep"}],
    }

    async with _client() as c:
        with (
            mock_user(ADMIN),
            mock_db_session(mock_db),
        ):
            resp = await c.put("/pipeline-config", json=payload)

    assert resp.status_code == 200
    data = resp.json()
    assert "ic_prep" in data["stage_order"]
    assert data["stage_labels"]["inbox"] == "New Deals"


@pytest.mark.anyio
async def test_put_pipeline_config_exceeds_3_custom_stages():
    mock_db = AsyncMock()

    payload = {
        "stage_labels": {},
        "custom_stages": [
            {"key": "s1", "label": "S1"},
            {"key": "s2", "label": "S2"},
            {"key": "s3", "label": "S3"},
            {"key": "s4", "label": "S4"},
        ],
    }

    async with _client() as c:
        with (
            mock_user(ADMIN),
            mock_db_session(mock_db),
        ):
            resp = await c.put("/pipeline-config", json=payload)

    assert resp.status_code == 422


@pytest.mark.anyio
async def test_put_pipeline_config_reserved_key_rejected():
    mock_db = AsyncMock()

    payload = {
        "stage_labels": {},
        "custom_stages": [{"key": "inbox", "label": "Inbox2"}],
    }

    async with _client() as c:
        with (
            mock_user(ADMIN),
            mock_db_session(mock_db),
        ):
            resp = await c.put("/pipeline-config", json=payload)

    assert resp.status_code == 422
