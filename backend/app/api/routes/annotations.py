"""
Inline editing and annotation endpoints — data collection seam for fine-tuning.

All edits capture the original AI-generated text at call time so we have
clean (input, output) pairs for future LoRA fine-tuning. The `original_text`
field is immutable after creation.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, conint
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.analysis import AnalysisResult, DDQuestion, MemoEdit, ScorecardScore
from app.models.base import User

router = APIRouter(prefix="/analysis", tags=["annotations"])


# ── Scorecard score override ────────────────────────────────────────────────

class ScoreOverrideIn(BaseModel):
    human_score: conint(ge=1, le=5)  # type: ignore[valid-type]


class ScoreOverrideOut(BaseModel):
    id: uuid.UUID
    dimension_key: str
    ai_score: int
    human_score: int
    rationale: str | None


@router.patch("/{deal_id}/scorecard/{score_id}", response_model=ScoreOverrideOut)
async def override_scorecard_score(
    deal_id: uuid.UUID,
    score_id: uuid.UUID,
    body: ScoreOverrideIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ScoreOverrideOut:
    """Any authenticated user can override a scorecard score with their own assessment."""
    score = await db.get(ScorecardScore, score_id)
    if score is None:
        raise HTTPException(status_code=404, detail="Score not found")

    # Verify tenant isolation via the parent analysis
    ar = await db.get(AnalysisResult, score.analysis_id)
    if ar is None or ar.tenant_id != user.tenant_id or ar.deal_id != deal_id:
        raise HTTPException(status_code=404, detail="Score not found")

    score.human_score = body.human_score
    await db.commit()
    await db.refresh(score)

    return ScoreOverrideOut(
        id=score.id,
        dimension_key=score.dimension_key,
        ai_score=score.ai_score,
        human_score=score.human_score or score.ai_score,
        rationale=score.rationale,
    )


# ── DD question editing ─────────────────────────────────────────────────────

class DDEditIn(BaseModel):
    edited_question: str


class DDEditOut(BaseModel):
    id: uuid.UUID
    question: str
    edited_question: str | None
    risk_level: str
    position: int


@router.patch("/{deal_id}/dd-questions/{question_id}", response_model=DDEditOut)
async def edit_dd_question(
    deal_id: uuid.UUID,
    question_id: uuid.UUID,
    body: DDEditIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DDEditOut:
    """Edit a DD question — stores alongside the original for fine-tuning."""
    q = await db.get(DDQuestion, question_id)
    if q is None:
        raise HTTPException(status_code=404, detail="Question not found")

    ar = await db.get(AnalysisResult, q.analysis_id)
    if ar is None or ar.tenant_id != user.tenant_id or ar.deal_id != deal_id:
        raise HTTPException(status_code=404, detail="Question not found")

    q.edited_question = body.edited_question
    await db.commit()

    return DDEditOut(
        id=q.id,
        question=q.question,
        edited_question=q.edited_question,
        risk_level=q.risk_level.value,
        position=q.position,
    )


# ── Memo editing ─────────────────────────────────────────────────────────────

class MemoEditIn(BaseModel):
    edited_text: str
    section: str = "memo"


class MemoEditOut(BaseModel):
    id: uuid.UUID
    section: str
    original_text: str
    edited_text: str


@router.patch("/{deal_id}/memo", response_model=MemoEditOut)
async def edit_memo(
    deal_id: uuid.UUID,
    body: MemoEditIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MemoEditOut:
    """
    Save an inline edit to the investment memo.
    Captures original_text from the current DB value at the moment of edit.
    """
    result = await db.execute(
        select(AnalysisResult).where(AnalysisResult.deal_id == deal_id)
    )
    ar = result.scalar_one_or_none()
    if ar is None or ar.tenant_id != user.tenant_id:
        raise HTTPException(status_code=404, detail="Analysis not found")

    # original_text is captured NOW — not what the user typed — for fine-tuning integrity
    original_text = ar.memo_edited_text or ar.memo_text or ""

    edit = MemoEdit(
        analysis_id=ar.id,
        tenant_id=user.tenant_id,
        actor_id=user.id,
        original_text=original_text,
        edited_text=body.edited_text,
        section=body.section,
    )
    db.add(edit)

    # Update the live edited text on the analysis record
    ar.memo_edited_text = body.edited_text
    await db.commit()
    await db.refresh(edit)

    return MemoEditOut(
        id=edit.id,
        section=edit.section,
        original_text=edit.original_text,
        edited_text=edit.edited_text,
    )


@router.get("/{deal_id}/memo/history", response_model=list[MemoEditOut])
async def get_memo_edit_history(
    deal_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[MemoEditOut]:
    """Return the full edit history for a deal's memo (for audit + fine-tuning)."""
    result = await db.execute(
        select(AnalysisResult).where(AnalysisResult.deal_id == deal_id)
    )
    ar = result.scalar_one_or_none()
    if ar is None or ar.tenant_id != user.tenant_id:
        raise HTTPException(status_code=404, detail="Analysis not found")

    edits_result = await db.execute(
        select(MemoEdit)
        .where(MemoEdit.analysis_id == ar.id)
        .order_by(MemoEdit.created_at.desc())
    )
    edits = edits_result.scalars().all()

    return [
        MemoEditOut(
            id=e.id,
            section=e.section,
            original_text=e.original_text,
            edited_text=e.edited_text,
        )
        for e in edits
    ]
