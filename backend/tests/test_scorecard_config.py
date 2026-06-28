"""Tests for per-tenant scorecard configuration (issue #8)."""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models.base import Role, Tenant, User

TENANT = Tenant(id=uuid.uuid4(), name="ACME VC", slug="acme-vc")
ADMIN = User(
    id=uuid.uuid4(),
    tenant_id=TENANT.id,
    clerk_user_id="user_admin",
    email="admin@acme.vc",
    role=Role.admin,
)
ANALYST = User(
    id=uuid.uuid4(),
    tenant_id=TENANT.id,
    clerk_user_id="user_analyst",
    email="analyst@acme.vc",
    role=Role.analyst,
)


def _make_client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


def _auth_patch(user: User):
    return patch("app.api.deps.get_current_user", return_value=user)


@pytest.mark.anyio
async def test_get_scorecard_config_empty():
    """Any user can GET config; empty for new tenant."""
    from sqlalchemy.ext.asyncio import AsyncSession

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_session = AsyncMock(spec=AsyncSession)
    mock_session.execute = AsyncMock(return_value=mock_result)
    mock_session.commit = AsyncMock()
    mock_session.refresh = AsyncMock()
    mock_session.add = MagicMock()

    async with _make_client() as client:
        with (
            _auth_patch(ANALYST),
            patch("app.core.database.get_db", return_value=mock_session),
        ):
            resp = await client.get("/scorecard-config")

    assert resp.status_code == 200
    assert resp.json()["custom_dims"] == []


@pytest.mark.anyio
async def test_set_scorecard_config_non_admin_returns_403():
    async with _make_client() as client:
        with _auth_patch(ANALYST):
            resp = await client.put(
                "/scorecard-config",
                json={"custom_dims": [{"key": "founder_fit", "label": "Founder Fit"}]},
            )
    assert resp.status_code == 403


@pytest.mark.anyio
async def test_set_scorecard_config_reserved_key_returns_422():
    async with _make_client() as client:
        with _auth_patch(ADMIN):
            resp = await client.put(
                "/scorecard-config",
                json={"custom_dims": [{"key": "team", "label": "Team (reserved!)"}]},
            )
    assert resp.status_code == 422
    assert "conflict" in resp.json()["detail"].lower()


@pytest.mark.anyio
async def test_set_scorecard_config_too_many_dims_returns_422():
    dims = [{"key": f"dim_{i}", "label": f"Dim {i}"} for i in range(11)]
    async with _make_client() as client:
        with _auth_patch(ADMIN):
            resp = await client.put("/scorecard-config", json={"custom_dims": dims})
    assert resp.status_code == 422
    assert "10" in resp.json()["detail"]


@pytest.mark.anyio
async def test_set_scorecard_config_invalid_key_format():
    async with _make_client() as client:
        with _auth_patch(ADMIN):
            resp = await client.put(
                "/scorecard-config",
                json={"custom_dims": [{"key": "Invalid Key!", "label": "Bad"}]},
            )
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_set_scorecard_config_valid():
    """Admin can set valid custom dimensions."""
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.models.pipeline import TenantConfig

    existing_config = TenantConfig(
        id=uuid.uuid4(),
        tenant_id=TENANT.id,
        custom_scorecard_dims=[],
    )

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = existing_config
    mock_session = AsyncMock(spec=AsyncSession)
    mock_session.execute = AsyncMock(return_value=mock_result)
    mock_session.commit = AsyncMock()
    mock_session.refresh = AsyncMock()

    async with _make_client() as client:
        with (
            _auth_patch(ADMIN),
            patch("app.core.database.get_db", return_value=mock_session),
        ):
            resp = await client.put(
                "/scorecard-config",
                json={
                    "custom_dims": [
                        {"key": "founder_market_fit", "label": "Founder-Market Fit", "description": "How well the founder knows the space"}
                    ]
                },
            )

    assert resp.status_code == 200
    dims = resp.json()["custom_dims"]
    assert len(dims) == 1
    assert dims[0]["key"] == "founder_market_fit"
