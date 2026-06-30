"""Tests for inline editing & annotation endpoints (issue #9)."""

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models.analysis import (
    AnalysisResult,
    AnalysisStatus,
    DDQuestion,
    RiskLevel,
    ScorecardScore,
)
from app.models.base import Role, Tenant, User
from tests.conftest import mock_db_session, mock_user

TENANT = Tenant(id=uuid.uuid4(), name="Test VC", slug="test-vc")
ANALYST = User(
    id=uuid.uuid4(),
    tenant_id=TENANT.id,
    clerk_user_id="user_analyst_ann",
    email="a@vc.com",
    role=Role.analyst,
)
DEAL_ID = uuid.uuid4()
ANALYSIS_ID = uuid.uuid4()
SCORE_ID = uuid.uuid4()
QUESTION_ID = uuid.uuid4()


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


def _auth_patch():
    return mock_user(ANALYST)


@pytest.mark.anyio
async def test_override_scorecard_requires_auth():
    async with _client() as c:
        resp = await c.patch(f"/analysis/{DEAL_ID}/scorecard/{SCORE_ID}", json={"human_score": 4})
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_override_scorecard_invalid_score_422():
    async with _client() as c:
        with _auth_patch():
            resp = await c.patch(
                f"/analysis/{DEAL_ID}/scorecard/{SCORE_ID}",
                json={"human_score": 6},
            )
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_override_scorecard_not_found_404():
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=None)

    async with _client() as c:
        with (
            _auth_patch(),
            mock_db_session(mock_db),
        ):
            resp = await c.patch(
                f"/analysis/{DEAL_ID}/scorecard/{SCORE_ID}",
                json={"human_score": 4},
            )
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_override_scorecard_valid():
    score = ScorecardScore(
        id=SCORE_ID,
        analysis_id=ANALYSIS_ID,
        dimension_key="team",
        ai_score=3,
        rationale="Good team",
    )
    ar = AnalysisResult(
        id=ANALYSIS_ID,
        deal_id=DEAL_ID,
        tenant_id=ANALYST.tenant_id,
        status=AnalysisStatus.complete,
    )

    def _get(model, pk):
        if model.__tablename__ == "scorecard_scores":
            return score
        if model.__tablename__ == "analysis_results":
            return ar
        return None

    mock_db = AsyncMock()
    mock_db.get = AsyncMock(side_effect=_get)
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    async with _client() as c:
        with (
            _auth_patch(),
            mock_db_session(mock_db),
        ):
            resp = await c.patch(
                f"/analysis/{DEAL_ID}/scorecard/{SCORE_ID}",
                json={"human_score": 5},
            )

    assert resp.status_code == 200
    data = resp.json()
    assert data["human_score"] == 5
    assert data["ai_score"] == 3
    assert data["dimension_key"] == "team"


@pytest.mark.anyio
async def test_edit_memo_captures_original_text():
    """PATCH /analysis/{id}/memo must save original AI text before storing edit."""
    ar = AnalysisResult(
        id=ANALYSIS_ID,
        deal_id=DEAL_ID,
        tenant_id=ANALYST.tenant_id,
        status=AnalysisStatus.complete,
        memo_text="Original AI memo text",
        memo_edited_text=None,
    )

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = ar
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mock_result)
    mock_db.add = MagicMock()
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock(side_effect=lambda obj: setattr(obj, "id", uuid.uuid4()))

    async with _client() as c:
        with (
            _auth_patch(),
            mock_db_session(mock_db),
        ):
            resp = await c.patch(
                f"/analysis/{DEAL_ID}/memo",
                json={"edited_text": "Human-refined memo text"},
            )

    assert resp.status_code == 200
    data = resp.json()
    assert data["original_text"] == "Original AI memo text"
    assert data["edited_text"] == "Human-refined memo text"

    # Verify edit was persisted
    assert mock_db.add.called
    from app.models.analysis import MemoEdit
    added = mock_db.add.call_args[0][0]
    assert isinstance(added, MemoEdit)
    assert added.original_text == "Original AI memo text"


@pytest.mark.anyio
async def test_edit_dd_question():
    q = DDQuestion(
        id=QUESTION_ID,
        analysis_id=ANALYSIS_ID,
        question="What is your CAC?",
        risk_level=RiskLevel.high,
        position=0,
    )
    ar = AnalysisResult(
        id=ANALYSIS_ID,
        deal_id=DEAL_ID,
        tenant_id=ANALYST.tenant_id,
        status=AnalysisStatus.complete,
    )

    def _get(model, pk):
        if model.__tablename__ == "dd_questions":
            return q
        if model.__tablename__ == "analysis_results":
            return ar
        return None

    mock_db = AsyncMock()
    mock_db.get = AsyncMock(side_effect=_get)
    mock_db.commit = AsyncMock()

    async with _client() as c:
        with (
            _auth_patch(),
            mock_db_session(mock_db),
        ):
            resp = await c.patch(
                f"/analysis/{DEAL_ID}/dd-questions/{QUESTION_ID}",
                json={"edited_question": "What is your blended CAC and how does it trend?"},
            )

    assert resp.status_code == 200
    data = resp.json()
    assert data["question"] == "What is your CAC?"
    assert data["edited_question"] == "What is your blended CAC and how does it trend?"
