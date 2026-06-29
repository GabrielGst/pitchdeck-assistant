"""
Engagement event ingestion — passive interaction signals from the analysis view.

Events are stored for future model training; no UI reads this data in v1.
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.base import Deal, User
from app.models.engagement import EngagementEvent

router = APIRouter(prefix="/events", tags=["events"])

ALLOWED_EVENT_TYPES = {
    "section_dwell",
    "memo_copied",
    "scorecard_expanded",
    "scorecard_collapsed",
    "dd_question_clicked",
    "dd_question_dismissed",
}

ALLOWED_SECTIONS = {"scorecard", "dd_questions", "memo"}


class EngagementEventIn(BaseModel):
    event_type: str = Field(..., max_length=50)
    section: str | None = Field(None, max_length=50)
    value: float | None = None
    timestamp: datetime


class BatchEngagementRequest(BaseModel):
    deal_id: uuid.UUID
    events: list[EngagementEventIn] = Field(..., max_length=200)


@router.post("/engagement", status_code=204)
async def ingest_engagement(
    body: BatchEngagementRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    deal = await db.get(Deal, body.deal_id)
    if deal is None or deal.tenant_id != user.tenant_id:
        raise HTTPException(status_code=404, detail="Deal not found")

    for ev in body.events:
        if ev.event_type not in ALLOWED_EVENT_TYPES:
            continue
        if ev.section is not None and ev.section not in ALLOWED_SECTIONS:
            continue
        db.add(EngagementEvent(
            deal_id=body.deal_id,
            tenant_id=user.tenant_id,
            user_id=user.id,
            event_type=ev.event_type,
            section=ev.section,
            value=ev.value,
            timestamp=ev.timestamp.astimezone(timezone.utc).replace(tzinfo=None),
        ))

    await db.commit()
