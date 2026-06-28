"""
SSE streaming endpoint for AI analysis.

Two-phase architecture:
  Phase 1 (Celery): text extraction + embedding + retrieval → publishes EXTRACTION_COMPLETE
  Phase 2 (here):   subscribes to Redis channel → streams LLM output via SSE
"""

import asyncio
import json
import uuid
from collections.abc import AsyncGenerator

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.auth import verify_clerk_token
from app.core.config import settings
from app.core.database import get_db
from app.models.analysis import AnalysisResult, AnalysisStatus, DDQuestion, RiskLevel, ScorecardScore
from app.models.base import Deal, Deck, DeckStatus, User

router = APIRouter(prefix="/analysis", tags=["analysis"])

EXTRACTION_TIMEOUT = 120  # seconds to wait for Celery extraction to complete


async def _get_sse_user(
    token: str,
    db: AsyncSession = Depends(get_db),
) -> User:
    """Auth dependency for SSE endpoints — accepts token as query param because
    EventSource browser API cannot set custom headers."""
    if not token:
        raise HTTPException(status_code=401, detail="Missing token")
    try:
        clerk_user_id = await verify_clerk_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    result = await db.execute(select(User).where(User.clerk_user_id == clerk_user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not provisioned")
    return user


def _sse(event: str, data: object) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def _wait_for_extraction(deck_id: str, timeout: int = EXTRACTION_TIMEOUT) -> bool:
    """Poll Redis pub/sub until EXTRACTION_COMPLETE or timeout."""
    r = aioredis.Redis.from_url(settings.redis_url)
    pubsub = r.pubsub()
    await pubsub.subscribe(f"deck:{deck_id}:status")
    try:
        deadline = asyncio.get_event_loop().time() + timeout
        async for message in pubsub.listen():
            if asyncio.get_event_loop().time() > deadline:
                return False
            if message["type"] == "message" and message["data"] == b"EXTRACTION_COMPLETE":
                return True
    finally:
        await pubsub.unsubscribe(f"deck:{deck_id}:status")
        await r.aclose()
    return False


async def _stream_analysis(
    deal: Deal,
    deck: Deck,
    user: User,
    db: AsyncSession,
) -> AsyncGenerator[str, None]:
    from app.services import analysis_service

    # Create pending AnalysisResult record
    existing = await db.execute(select(AnalysisResult).where(AnalysisResult.deal_id == deal.id))
    ar = existing.scalar_one_or_none()
    if ar is None:
        ar = AnalysisResult(
            deal_id=deal.id,
            tenant_id=user.tenant_id,
            status=AnalysisStatus.pending,
            llm_model=settings.llm_model,
        )
        db.add(ar)
        await db.commit()
        await db.refresh(ar)

    yield _sse("progress", {"stage": "starting"})

    # Retrieve thesis context (corpus B) — empty string if corpus is empty or below threshold
    from app.services import embedding_service
    thesis_ctx = await embedding_service.retrieve_thesis_context(
        query_text=deck.extracted_text or "",
        tenant_id=user.tenant_id,
        db=db,
    )

    # Retrieve comparable deals (corpus A) — empty string if no prior deals
    deal_ctx = await embedding_service.retrieve_deal_context(
        query_text=deck.extracted_text or "",
        tenant_id=user.tenant_id,
        exclude_deal_id=deal.id,
        db=db,
    )

    combined_context = "\n\n".join(filter(None, [thesis_ctx, deal_ctx]))

    # Load custom scorecard dimensions for this tenant
    from app.models.pipeline import TenantConfig
    cfg_result = await db.execute(select(TenantConfig).where(TenantConfig.tenant_id == user.tenant_id))
    tenant_cfg = cfg_result.scalar_one_or_none()
    custom_dims = (tenant_cfg.custom_scorecard_dims or []) if tenant_cfg else []

    # Yield from sync generator in a thread pool to avoid blocking the event loop
    loop = asyncio.get_event_loop()
    queue: asyncio.Queue[tuple[str, object] | None] = asyncio.Queue()

    def _run_generator() -> None:
        try:
            for event, payload in analysis_service.generate(
                deck_text=deck.extracted_text or "",
                deal_id=str(deal.id),
                tenant_id=str(user.tenant_id),
                thesis_context=combined_context,
                custom_dims=custom_dims,
            ):
                asyncio.run_coroutine_threadsafe(queue.put((event, payload)), loop)
        finally:
            asyncio.run_coroutine_threadsafe(queue.put(None), loop)

    import threading
    thread = threading.Thread(target=_run_generator, daemon=True)
    thread.start()

    scorecard_data: list[dict] = []
    dd_data: list[dict] = []
    memo_text = ""

    while True:
        item = await queue.get()
        if item is None:
            break
        event, payload = item

        yield _sse(event, payload)

        if event == "scorecard":
            scorecard_data = payload  # type: ignore[assignment]
        elif event == "dd_questions":
            dd_data = payload  # type: ignore[assignment]
        elif event == "complete":
            memo_text = payload.get("memo_text", "")  # type: ignore[union-attr]
        elif event == "error":
            ar.status = AnalysisStatus.failed
            await db.commit()
            return

    # Persist results to DB
    ar.memo_text = memo_text
    ar.status = AnalysisStatus.complete
    await db.commit()

    for dim in scorecard_data:
        db.add(ScorecardScore(
            analysis_id=ar.id,
            dimension_key=dim["key"],
            ai_score=dim["score"],
            rationale=dim.get("rationale", ""),
            is_custom=dim.get("is_custom", False),
        ))

    for item in dd_data:
        db.add(DDQuestion(
            analysis_id=ar.id,
            question=item["question"],
            risk_level=RiskLevel(item.get("risk_level", "medium")),
            position=item["position"],
        ))

    await db.commit()
    yield _sse("done", {"analysis_id": str(ar.id)})


@router.get("/{deal_id}/stream")
async def stream_analysis(
    deal_id: uuid.UUID,
    user: User = Depends(_get_sse_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    deal = await db.get(Deal, deal_id)
    if deal is None or deal.tenant_id != user.tenant_id:
        raise HTTPException(status_code=404, detail="Deal not found")

    deck = await db.get(Deck, deal.deck_id)
    if deck is None:
        raise HTTPException(status_code=404, detail="Deck not found")

    # If deck is still processing, wait for extraction to complete
    if deck.status == DeckStatus.processing:
        extracted = await _wait_for_extraction(str(deck.id))
        if not extracted:
            raise HTTPException(status_code=202, detail="Deck still processing — try again shortly")
        await db.refresh(deck)

    if deck.status != DeckStatus.processed:
        raise HTTPException(status_code=202, detail="Deck not yet processed")

    return StreamingResponse(
        _stream_analysis(deal, deck, user, db),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


class AnalysisOut(BaseModel):
    id: uuid.UUID
    deal_id: uuid.UUID
    status: str
    llm_model: str | None
    scorecard: list[dict]
    dd_questions: list[dict]
    memo_text: str | None


@router.get("/{deal_id}", response_model=AnalysisOut)
async def get_analysis(
    deal_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AnalysisOut:
    """Fetch a completed analysis (for page reload after SSE stream ends)."""
    deal = await db.get(Deal, deal_id)
    if deal is None or deal.tenant_id != user.tenant_id:
        raise HTTPException(status_code=404, detail="Deal not found")

    result = await db.execute(
        select(AnalysisResult).where(AnalysisResult.deal_id == deal_id)
    )
    ar = result.scalar_one_or_none()
    if ar is None:
        raise HTTPException(status_code=404, detail="Analysis not found")

    await db.refresh(ar, ["scores", "dd_questions"])

    return AnalysisOut(
        id=ar.id,
        deal_id=ar.deal_id,
        status=ar.status.value,
        llm_model=ar.llm_model,
        scorecard=[
            {"key": s.dimension_key, "score": s.human_score or s.ai_score, "ai_score": s.ai_score, "rationale": s.rationale, "is_custom": s.is_custom}
            for s in ar.scores
        ],
        dd_questions=[
            {"id": str(q.id), "question": q.edited_question or q.question, "risk_level": q.risk_level.value, "position": q.position}
            for q in ar.dd_questions
        ],
        memo_text=ar.memo_edited_text or ar.memo_text,
    )
