import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
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
    deck_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class DealsGrouped(BaseModel):
    stage: str
    deals: list[DealOut]


@router.get("", response_model=list[DealOut])
async def list_deals(
    stage: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[DealOut]:
    """List all deals for the current tenant, optionally filtered by stage."""
    query = select(Deal).where(Deal.tenant_id == user.tenant_id).order_by(Deal.created_at.desc())
    if stage:
        try:
            query = query.where(Deal.stage == DealStage(stage))
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Invalid stage: {stage}")

    result = await db.execute(query)
    deals = result.scalars().all()
    return [
        DealOut(
            id=d.id,
            company_name=d.company_name,
            stage=d.stage.value,
            deck_id=d.deck_id,
            created_at=d.created_at,
            updated_at=d.updated_at,
        )
        for d in deals
    ]


@router.get("/kanban", response_model=list[DealsGrouped])
async def kanban_board(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[DealsGrouped]:
    """Return all deals grouped by pipeline stage for the Kanban view."""
    result = await db.execute(
        select(Deal).where(Deal.tenant_id == user.tenant_id).order_by(Deal.created_at.desc())
    )
    all_deals = result.scalars().all()

    grouped: dict[str, list[DealOut]] = {s.value: [] for s in DealStage}
    for d in all_deals:
        grouped[d.stage.value].append(
            DealOut(
                id=d.id,
                company_name=d.company_name,
                stage=d.stage.value,
                deck_id=d.deck_id,
                created_at=d.created_at,
                updated_at=d.updated_at,
            )
        )

    return [DealsGrouped(stage=stage, deals=deals) for stage, deals in grouped.items()]


@router.get("/{deal_id}", response_model=DealOut)
async def get_deal(
    deal_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DealOut:
    deal = await db.get(Deal, deal_id)
    if deal is None or deal.tenant_id != user.tenant_id:
        raise HTTPException(status_code=404, detail="Deal not found")
    return DealOut(
        id=deal.id,
        company_name=deal.company_name,
        stage=deal.stage.value,
        deck_id=deal.deck_id,
        created_at=deal.created_at,
        updated_at=deal.updated_at,
    )
