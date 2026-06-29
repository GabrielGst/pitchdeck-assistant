"""
Deal pipeline management — stage transitions with role enforcement.

Key invariant: only Partner and Admin can set terminal stages (invested, passed).
Every transition is recorded in pipeline_transitions for audit and dwell-time analytics.
"""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import update

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.base import Deal, DealStage, PARTNER_ONLY_STAGES, Role, User
from app.models.corpus import CorpusAChunk
from app.models.pipeline import PipelineTransition, TenantConfig

router = APIRouter(prefix="/deals", tags=["pipeline"])

TERMINAL_STAGES = {DealStage.invested, DealStage.passed}


class TransitionRequest(BaseModel):
    stage: str
    note: str | None = None


class TransitionOut(BaseModel):
    deal_id: uuid.UUID
    from_stage: str | None
    to_stage: str
    actor_id: uuid.UUID
    created_at: datetime


@router.patch("/{deal_id}/stage", response_model=TransitionOut)
async def transition_stage(
    deal_id: uuid.UUID,
    body: TransitionRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TransitionOut:
    # Load deal and enforce tenant isolation early
    deal = await db.get(Deal, deal_id)
    if deal is None or deal.tenant_id != user.tenant_id:
        raise HTTPException(status_code=404, detail="Deal not found")

    # Deals in terminal states cannot be moved
    if deal.stage in TERMINAL_STAGES:
        raise HTTPException(
            status_code=409,
            detail=f"Deal is in terminal state '{deal.stage.value}' and cannot be moved",
        )

    # Resolve target — check universal enum first, then tenant custom stages
    target: DealStage | None = None
    custom_stage_key: str | None = None

    try:
        target = DealStage(body.stage)
    except ValueError:
        # Check if it's a custom stage key for this tenant
        cfg_result = await db.execute(
            select(TenantConfig).where(TenantConfig.tenant_id == user.tenant_id)
        )
        cfg = cfg_result.scalar_one_or_none()
        custom_keys = {s["key"] for s in (cfg.custom_stages if cfg else []) or []}
        if body.stage in custom_keys:
            target = DealStage.partner_review
            custom_stage_key = body.stage
        else:
            raise HTTPException(status_code=422, detail=f"Invalid stage: {body.stage}")

    # Terminal stage gate — Partner and Admin only
    if target in PARTNER_ONLY_STAGES and user.role not in (Role.partner, Role.admin):
        raise HTTPException(
            status_code=403,
            detail=f"Only Partners and Admins can move deals to '{target.value}'",
        )

    from_stage = deal.stage
    deal.stage = target
    deal.custom_stage = custom_stage_key  # None clears any prior custom stage

    transition = PipelineTransition(
        deal_id=deal.id,
        tenant_id=user.tenant_id,
        actor_id=user.id,
        from_stage=from_stage,
        to_stage=target,
        note=body.note,
    )
    db.add(transition)

    # Propagate outcome label to corpus_a embeddings for future retrieval
    if target in TERMINAL_STAGES:
        await db.execute(
            update(CorpusAChunk)
            .where(CorpusAChunk.deal_id == deal.id)
            .values(outcome=target.value)
        )

    await db.commit()
    await db.refresh(transition)

    effective_stage = custom_stage_key or transition.to_stage.value
    return TransitionOut(
        deal_id=deal.id,
        from_stage=from_stage.value if from_stage else None,
        to_stage=effective_stage,
        actor_id=user.id,
        created_at=transition.created_at,
    )


@router.get("/{deal_id}/transitions", response_model=list[TransitionOut])
async def get_transitions(
    deal_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[TransitionOut]:
    """Return the full transition history for a deal (dwell time source of truth)."""
    deal = await db.get(Deal, deal_id)
    if deal is None or deal.tenant_id != user.tenant_id:
        raise HTTPException(status_code=404, detail="Deal not found")

    result = await db.execute(
        select(PipelineTransition)
        .where(PipelineTransition.deal_id == deal_id)
        .order_by(PipelineTransition.created_at.asc())
    )
    transitions = result.scalars().all()

    return [
        TransitionOut(
            deal_id=t.deal_id,
            from_stage=t.from_stage.value if t.from_stage else None,
            to_stage=t.to_stage.value,
            actor_id=t.actor_id,
            created_at=t.created_at,
        )
        for t in transitions
    ]
