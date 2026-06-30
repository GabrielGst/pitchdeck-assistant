"""
Tests for PATCH /deals/{id}/stage — primary API seam for role enforcement.
These are the most critical tests in the codebase: they protect training label integrity.
"""

import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models.base import PARTNER_ONLY_STAGES, Deal, DealStage, Role, Tenant, User
from app.models.pipeline import PipelineTransition

TENANT = Tenant(id=uuid.uuid4(), name="Test VC", slug="test-vc")

ANALYST = User(id=uuid.uuid4(), tenant_id=TENANT.id, clerk_user_id="user_analyst", email="a@vc.com", role=Role.analyst)
ASSOCIATE = User(id=uuid.uuid4(), tenant_id=TENANT.id, clerk_user_id="user_assoc", email="b@vc.com", role=Role.associate)
PARTNER = User(id=uuid.uuid4(), tenant_id=TENANT.id, clerk_user_id="user_partner", email="c@vc.com", role=Role.partner)
ADMIN = User(id=uuid.uuid4(), tenant_id=TENANT.id, clerk_user_id="user_admin", email="d@vc.com", role=Role.admin)

DEAL_IN_INBOX = Deal(
    id=uuid.uuid4(),
    tenant_id=TENANT.id,
    deck_id=uuid.uuid4(),
    company_name="Acme",
    stage=DealStage.inbox,
    created_at=datetime.now(UTC),
    updated_at=datetime.now(UTC),
)


def _mock_session_for_user(user: User, deal: Deal | None = DEAL_IN_INBOX):
    """Returns a mock AsyncSession that resolves the given user and deal."""
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = user

    transition = PipelineTransition(
        id=uuid.uuid4(),
        deal_id=deal.id if deal else uuid.uuid4(),
        tenant_id=TENANT.id,
        actor_id=user.id,
        from_stage=deal.stage if deal else None,
        to_stage=DealStage.screening,
        created_at=datetime.now(UTC),
    )

    session = AsyncMock()
    session.execute = AsyncMock(return_value=mock_result)
    session.get = AsyncMock(side_effect=lambda model, pk: deal if model == Deal else TENANT)
    session.add = MagicMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock(side_effect=lambda obj: setattr(obj, "created_at", transition.created_at) or None)
    session.__aenter__ = AsyncMock(return_value=session)
    session.__aexit__ = AsyncMock(return_value=None)
    return session


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


async def test_analyst_cannot_move_to_invested(client: AsyncClient) -> None:
    session = _mock_session_for_user(ANALYST)
    with (
        patch("app.api.deps.verify_clerk_token", return_value=ANALYST.clerk_user_id),
        patch("app.core.database.AsyncSessionLocal", return_value=session),
    ):
        resp = await client.patch(
            f"/deals/{DEAL_IN_INBOX.id}/stage",
            json={"stage": "invested"},
            headers={"Authorization": "Bearer token"},
        )
    assert resp.status_code == 403
    assert "Partner" in resp.json()["detail"]


async def test_associate_cannot_move_to_passed(client: AsyncClient) -> None:
    session = _mock_session_for_user(ASSOCIATE)
    with (
        patch("app.api.deps.verify_clerk_token", return_value=ASSOCIATE.clerk_user_id),
        patch("app.core.database.AsyncSessionLocal", return_value=session),
    ):
        resp = await client.patch(
            f"/deals/{DEAL_IN_INBOX.id}/stage",
            json={"stage": "passed"},
            headers={"Authorization": "Bearer token"},
        )
    assert resp.status_code == 403


async def test_partner_can_move_to_invested(client: AsyncClient) -> None:
    deal = Deal(
        id=uuid.uuid4(), tenant_id=TENANT.id, deck_id=uuid.uuid4(),
        company_name="Acme", stage=DealStage.partner_review,
        created_at=datetime.now(UTC), updated_at=datetime.now(UTC),
    )
    session = _mock_session_for_user(PARTNER, deal)
    with (
        patch("app.api.deps.verify_clerk_token", return_value=PARTNER.clerk_user_id),
        patch("app.core.database.AsyncSessionLocal", return_value=session),
    ):
        resp = await client.patch(
            f"/deals/{deal.id}/stage",
            json={"stage": "invested"},
            headers={"Authorization": "Bearer token"},
        )
    assert resp.status_code == 200
    assert resp.json()["to_stage"] == "invested"


async def test_admin_can_move_to_passed(client: AsyncClient) -> None:
    session = _mock_session_for_user(ADMIN)
    with (
        patch("app.api.deps.verify_clerk_token", return_value=ADMIN.clerk_user_id),
        patch("app.core.database.AsyncSessionLocal", return_value=session),
    ):
        resp = await client.patch(
            f"/deals/{DEAL_IN_INBOX.id}/stage",
            json={"stage": "passed", "note": "Not a fit for our thesis"},
            headers={"Authorization": "Bearer token"},
        )
    assert resp.status_code == 200
    assert resp.json()["to_stage"] == "passed"


async def test_analyst_can_move_to_screening(client: AsyncClient) -> None:
    session = _mock_session_for_user(ANALYST)
    with (
        patch("app.api.deps.verify_clerk_token", return_value=ANALYST.clerk_user_id),
        patch("app.core.database.AsyncSessionLocal", return_value=session),
    ):
        resp = await client.patch(
            f"/deals/{DEAL_IN_INBOX.id}/stage",
            json={"stage": "screening"},
            headers={"Authorization": "Bearer token"},
        )
    assert resp.status_code == 200
    assert resp.json()["to_stage"] == "screening"


async def test_terminal_deal_cannot_be_moved(client: AsyncClient) -> None:
    invested_deal = Deal(
        id=uuid.uuid4(), tenant_id=TENANT.id, deck_id=uuid.uuid4(),
        company_name="Portfolio Co", stage=DealStage.invested,
        created_at=datetime.now(UTC), updated_at=datetime.now(UTC),
    )
    session = _mock_session_for_user(PARTNER, invested_deal)
    with (
        patch("app.api.deps.verify_clerk_token", return_value=PARTNER.clerk_user_id),
        patch("app.core.database.AsyncSessionLocal", return_value=session),
    ):
        resp = await client.patch(
            f"/deals/{invested_deal.id}/stage",
            json={"stage": "screening"},
            headers={"Authorization": "Bearer token"},
        )
    assert resp.status_code == 409


async def test_invalid_stage_returns_422(client: AsyncClient) -> None:
    session = _mock_session_for_user(ANALYST)
    with (
        patch("app.api.deps.verify_clerk_token", return_value=ANALYST.clerk_user_id),
        patch("app.core.database.AsyncSessionLocal", return_value=session),
    ):
        resp = await client.patch(
            f"/deals/{DEAL_IN_INBOX.id}/stage",
            json={"stage": "nonexistent"},
            headers={"Authorization": "Bearer token"},
        )
    assert resp.status_code == 422


async def test_partner_only_stages_set_is_correct() -> None:
    """Guard against accidental mutation of the PARTNER_ONLY_STAGES set."""
    assert DealStage.invested in PARTNER_ONLY_STAGES
    assert DealStage.passed in PARTNER_ONLY_STAGES
    assert DealStage.inbox not in PARTNER_ONLY_STAGES
    assert DealStage.screening not in PARTNER_ONLY_STAGES
