"""
Deal-scoped chat: persistent history, SSE streaming responses.
POST /deals/{deal_id}/chat — send message, stream SSE response
GET  /deals/{deal_id}/chat — fetch message history
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.base import Deal, User
from app.models.chat import ChatMessage

router = APIRouter(prefix="/deals", tags=["chat"])


class ChatRequest(BaseModel):
    message: str
    context_ref: str | None = None


class MessageOut(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    context_ref: str | None
    created_at: str


def _to_out(msg: ChatMessage) -> MessageOut:
    return MessageOut(
        id=msg.id,
        role=msg.role.value,
        content=msg.content,
        context_ref=msg.context_ref,
        created_at=msg.created_at.isoformat(),
    )


@router.post("/{deal_id}/chat")
async def send_chat(
    deal_id: uuid.UUID,
    body: ChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    deal = await db.get(Deal, deal_id)
    if deal is None or deal.tenant_id != user.tenant_id:
        raise HTTPException(status_code=404, detail="Deal not found")

    from app.services.chat_service import stream_chat

    return StreamingResponse(
        stream_chat(
            deal_id=deal_id,
            user_message=body.message,
            context_ref=body.context_ref,
            author_id=user.id,
            tenant_id=user.tenant_id,
            db=db,
        ),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/{deal_id}/chat", response_model=list[MessageOut])
async def get_chat_history(
    deal_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[MessageOut]:
    deal = await db.get(Deal, deal_id)
    if deal is None or deal.tenant_id != user.tenant_id:
        raise HTTPException(status_code=404, detail="Deal not found")

    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.deal_id == deal_id)
        .order_by(ChatMessage.created_at.asc())
    )
    return [_to_out(msg) for msg in result.scalars().all()]
