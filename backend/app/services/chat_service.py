"""
Streaming chat service for deal-scoped AI conversations.
Assembles context from deck text, supplementary docs, scorecard, DD questions, and memo,
then streams an LLM response via SSE while persisting messages to DB.
"""

import json
import uuid
from collections.abc import AsyncGenerator

import litellm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.analysis import AnalysisResult
from app.models.base import Deal, Deck
from app.models.chat import ChatMessage, ChatRole
from app.models.deal_documents import DealDocument


def _sse(event: str, data: object) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def stream_chat(
    deal_id: uuid.UUID,
    user_message: str,
    context_ref: str | None,
    author_id: uuid.UUID,
    tenant_id: uuid.UUID,
    db: AsyncSession,
) -> AsyncGenerator[str, None]:
    deal = await db.get(Deal, deal_id)
    if deal is None:
        yield _sse("error", {"detail": "Deal not found"})
        return

    deck = await db.get(Deck, deal.deck_id)

    docs_result = await db.execute(
        select(DealDocument).where(DealDocument.deal_id == deal_id)
    )
    docs = list(docs_result.scalars().all())

    ar_result = await db.execute(
        select(AnalysisResult).where(AnalysisResult.deal_id == deal_id)
    )
    ar = ar_result.scalar_one_or_none()

    history_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.deal_id == deal_id)
        .order_by(ChatMessage.created_at.asc())
        .limit(20)
    )
    history = list(history_result.scalars().all())

    # Build context string
    context_parts: list[str] = []

    if deck and deck.extracted_text:
        context_parts.append(f"=== PITCH DECK ===\n{deck.extracted_text[:8000]}")

    for doc in docs:
        if doc.extracted_text:
            context_parts.append(
                f"=== SUPPLEMENTARY DOC: {doc.filename} ===\n{doc.extracted_text[:3000]}"
            )

    if ar:
        memo = ar.memo_edited_text or ar.memo_text
        if memo:
            context_parts.append(f"=== INVESTMENT MEMO ===\n{memo[:4000]}")

        await db.refresh(ar, ["scores", "dd_questions"])

        if ar.scores:
            lines = [
                f"- {s.dimension_key}: {s.human_score or s.ai_score}/10 — {s.rationale}"
                for s in ar.scores
            ]
            context_parts.append("=== SCORECARD ===\n" + "\n".join(lines))

        if ar.dd_questions:
            lines = [
                f"[{q.risk_level.upper()}] {q.edited_question or q.question}"
                for q in ar.dd_questions
            ]
            context_parts.append("=== DUE DILIGENCE QUESTIONS ===\n" + "\n".join(lines))

    context_block = "\n\n".join(context_parts) if context_parts else "No context available yet."

    system_prompt = f"""You are an AI assistant for a venture capital firm, helping with deal analysis and due diligence for {deal.company_name}.

{context_block}

Your role:
- Answer due diligence questions using the provided documents
- Generate new relevant questions when appropriate
- Provide concise, actionable insights referenced to specific details from the documents
- When asked about the memo, refer to the investment memo section above

{f'The analyst is specifically referring to this passage: "{context_ref}"' if context_ref else ""}"""

    # Persist user message before streaming
    user_msg = ChatMessage(
        deal_id=deal_id,
        tenant_id=tenant_id,
        author_id=author_id,
        role=ChatRole.user,
        content=user_message,
        context_ref=context_ref,
    )
    db.add(user_msg)
    await db.commit()

    messages = [{"role": "system", "content": system_prompt}]
    for msg in history:
        messages.append({"role": msg.role.value, "content": msg.content})
    messages.append({"role": "user", "content": user_message})

    full_response = ""
    try:
        response = await litellm.acompletion(
            model=settings.llm_model,
            messages=messages,
            stream=True,
            max_tokens=2000,
        )
        async for chunk in response:
            delta = chunk.choices[0].delta.content or ""
            if delta:
                full_response += delta
                yield _sse("delta", {"text": delta})

    except Exception as exc:
        yield _sse("error", {"detail": str(exc)})
        return

    assistant_msg = ChatMessage(
        deal_id=deal_id,
        tenant_id=tenant_id,
        author_id=None,
        role=ChatRole.assistant,
        content=full_response,
        context_ref=None,
    )
    db.add(assistant_msg)
    await db.commit()
    await db.refresh(assistant_msg)

    yield _sse("done", {"message_id": str(assistant_msg.id)})
