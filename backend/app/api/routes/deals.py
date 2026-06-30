import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.base import Deal, DealStage, User

router = APIRouter(prefix="/deals", tags=["deals"])


class DealOut(BaseModel):
    id: uuid.UUID
    company_name: str
    stage: str
    custom_stage: str | None = None
    deck_id: uuid.UUID
    deck_status: str
    created_at: datetime
    updated_at: datetime


class DealsGrouped(BaseModel):
    stage: str
    deals: list[DealOut]


class StageUpdate(BaseModel):
    stage: str


def _deal_out(d: Deal) -> DealOut:
    return DealOut(
        id=d.id,
        company_name=d.company_name,
        stage=d.stage.value,
        custom_stage=d.custom_stage,
        deck_id=d.deck_id,
        deck_status=d.deck.status.value if d.deck else "unknown",
        created_at=d.created_at,
        updated_at=d.updated_at,
    )


@router.get("", response_model=list[DealOut])
async def list_deals(
    stage: str | None = None,
    q: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[DealOut]:
    query = (
        select(Deal)
        .where(Deal.tenant_id == user.tenant_id)
        .options(selectinload(Deal.deck))
        .order_by(Deal.created_at.desc())
    )
    if stage:
        try:
            query = query.where(Deal.stage == DealStage(stage))
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Invalid stage: {stage}")
    if q:
        query = query.where(Deal.company_name.ilike(f"%{q}%"))

    result = await db.execute(query)
    return [_deal_out(d) for d in result.scalars().all()]


@router.get("/kanban", response_model=list[DealsGrouped])
async def kanban_board(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[DealsGrouped]:
    result = await db.execute(
        select(Deal)
        .where(Deal.tenant_id == user.tenant_id)
        .options(selectinload(Deal.deck))
        .order_by(Deal.created_at.desc())
    )
    all_deals = result.scalars().all()

    grouped: dict[str, list[DealOut]] = {s.value: [] for s in DealStage}
    for d in all_deals:
        effective_stage = d.custom_stage or d.stage.value
        if effective_stage not in grouped:
            grouped[effective_stage] = []
        grouped[effective_stage].append(_deal_out(d))

    return [DealsGrouped(stage=stage, deals=deals) for stage, deals in grouped.items()]


@router.get("/{deal_id}", response_model=DealOut)
async def get_deal(
    deal_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DealOut:
    result = await db.execute(
        select(Deal)
        .where(Deal.id == deal_id)
        .options(selectinload(Deal.deck))
    )
    deal = result.scalar_one_or_none()
    if deal is None or deal.tenant_id != user.tenant_id:
        raise HTTPException(status_code=404, detail="Deal not found")
    return _deal_out(deal)


@router.patch("/{deal_id}/stage", response_model=DealOut)
async def update_stage(
    deal_id: uuid.UUID,
    body: StageUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DealOut:
    result = await db.execute(
        select(Deal)
        .where(Deal.id == deal_id)
        .options(selectinload(Deal.deck))
    )
    deal = result.scalar_one_or_none()
    if deal is None or deal.tenant_id != user.tenant_id:
        raise HTTPException(status_code=404, detail="Deal not found")

    try:
        deal.stage = DealStage(body.stage)
        deal.custom_stage = None
    except ValueError:
        deal.stage = DealStage.partner_review
        deal.custom_stage = body.stage

    await db.commit()
    await db.refresh(deal)
    return _deal_out(deal)


@router.delete("/{deal_id}", status_code=204)
async def delete_deal(
    deal_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    result = await db.execute(
        select(Deal)
        .where(Deal.id == deal_id)
        .options(selectinload(Deal.deck))
    )
    deal = result.scalar_one_or_none()
    if deal is None or deal.tenant_id != user.tenant_id:
        raise HTTPException(status_code=404, detail="Deal not found")

    deck = deal.deck
    await db.delete(deal)
    if deck:
        storage_path = Path(deck.storage_path)
        await db.delete(deck)
        if storage_path.exists():
            storage_path.unlink(missing_ok=True)

    await db.commit()
    return Response(status_code=204)
