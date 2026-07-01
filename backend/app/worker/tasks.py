import uuid
from typing import Any

from app.worker.celery_app import celery_app


@celery_app.task(name="worker.ping")
def ping() -> str:
    return "pong"


@celery_app.task(name="worker.process_deck", bind=True, max_retries=3)
def process_deck(self, deck_id: str, tenant_id: str) -> dict[str, Any]:
    """
    Extract text from an uploaded deck, chunk it, and mark the deck as processed.
    Publishes EXTRACTION_COMPLETE to Redis when done (consumed by the SSE endpoint in #5).
    """
    import redis
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    from app.core.config import settings
    from app.models.base import Deck, DeckStatus
    from app.services.document_parser import parse

    engine = create_engine(settings.database_url_sync, echo=False)

    with Session(engine) as session:
        deck = session.get(Deck, uuid.UUID(deck_id))
        if deck is None:
            return {"error": "deck not found"}

        deck.status = DeckStatus.processing
        session.commit()

        try:
            # Load raw bytes from storage path (local dev: filesystem; prod: S3)
            file_bytes = _load_file(deck.storage_path)
            extracted = parse(file_bytes, deck.mime_type, deck.filename)

            deck.extracted_text = extracted.full_text
            deck.status = DeckStatus.processed
            session.commit()

            # Update deal company name if we extracted a better one
            if deck.deal and extracted.company_name:
                deck.deal.company_name = extracted.company_name
                session.commit()

        except Exception as exc:
            deck.status = DeckStatus.failed
            session.commit()
            raise self.retry(exc=exc, countdown=30)

    # Auto-index into corpus A and run triage in parallel
    index_deal_into_corpus_a.delay(deck_id, tenant_id)
    triage_deck.delay(deck_id, tenant_id)

    # Publish extraction complete event so the SSE endpoint can begin streaming
    r = redis.Redis.from_url(settings.redis_url)
    r.publish(f"deck:{deck_id}:status", "EXTRACTION_COMPLETE")
    r.close()

    return {"deck_id": deck_id, "status": "processed"}


@celery_app.task(name="worker.index_deal_into_corpus_a", bind=True, max_retries=3)
def index_deal_into_corpus_a(self, deck_id: str, tenant_id: str) -> dict[str, Any]:
    """
    Embed a processed deck's text into corpus_a_chunks so future deals can
    retrieve historical context. Runs after EXTRACTION_COMPLETE is published,
    so the SSE analysis stream is not blocked by embedding latency.
    """
    import asyncio

    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    from app.core.config import settings
    from app.models.base import Deal, Deck

    engine = create_engine(settings.database_url_sync, echo=False)

    with Session(engine) as session:
        deck = session.get(Deck, uuid.UUID(deck_id))
        if deck is None or not deck.extracted_text:
            return {"error": "deck not found or has no text"}

        # Find the associated deal for this deck
        from sqlalchemy import select as sa_select
        deal = session.execute(
            sa_select(Deal).where(Deal.deck_id == uuid.UUID(deck_id))
        ).scalar_one_or_none()
        if deal is None:
            return {"error": "deal not found for deck"}

        deal_id_val = deal.id
        text = deck.extracted_text

    async def _embed_async() -> None:
        from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

        async_engine = create_async_engine(settings.database_url, echo=False)
        async with AsyncSession(async_engine) as async_session:
            from app.services.embedding_service import index_corpus_a
            await index_corpus_a(
                deal_id=deal_id_val,
                deck_id=uuid.UUID(deck_id),
                tenant_id=uuid.UUID(tenant_id),
                text=text,
                db=async_session,
            )

    try:
        asyncio.run(_embed_async())
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)

    return {"deck_id": deck_id, "status": "indexed_corpus_a"}


@celery_app.task(name="worker.index_thesis_document", bind=True, max_retries=3)
def index_thesis_document(self, document_id: str, tenant_id: str) -> dict[str, Any]:
    """
    Extract text from a thesis document and embed it into corpus_b_chunks.
    Runs async embedding in a sync Celery context via asyncio.run().
    """
    import asyncio

    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    from app.core.config import settings
    from app.models.corpus import DocIndexStatus, ThesisDocument
    from app.services.document_parser import parse

    engine = create_engine(settings.database_url_sync, echo=False)

    with Session(engine) as session:
        doc = session.get(ThesisDocument, uuid.UUID(document_id))
        if doc is None:
            return {"error": "document not found"}

        try:
            file_bytes = _load_file(doc.storage_path)
            mime = doc.mime_type

            # For plain text/markdown, skip document parser
            if mime in ("text/plain", "text/markdown"):
                full_text = file_bytes.decode("utf-8", errors="replace")
            else:
                extracted = parse(file_bytes, mime, doc.filename)
                full_text = extracted.full_text

            doc.full_text = full_text
            doc.status = DocIndexStatus.indexed
            session.commit()

        except Exception as exc:
            doc.status = DocIndexStatus.failed
            session.commit()
            raise self.retry(exc=exc, countdown=30)

    # Embed in a separate async context using a new async DB session
    async def _embed_async() -> None:
        from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

        async_engine = create_async_engine(settings.database_url, echo=False)
        async with AsyncSession(async_engine) as async_session:
            from app.services.embedding_service import index_corpus_b
            await index_corpus_b(
                document_id=uuid.UUID(document_id),
                tenant_id=uuid.UUID(tenant_id),
                text=full_text,
                db=async_session,
            )

    asyncio.run(_embed_async())
    return {"document_id": document_id, "status": "indexed"}


@celery_app.task(name="worker.triage_deck", bind=True, max_retries=2)
def triage_deck(self, deck_id: str, tenant_id: str) -> dict[str, Any]:
    """
    Run a lightweight LLM triage call on the extracted deck text and store
    the result in deal.triage. Fires in parallel with corpus indexing so it
    does not delay the SSE analysis stream.
    """
    from sqlalchemy import create_engine
    from sqlalchemy import select as sa_select
    from sqlalchemy.orm import Session

    from app.core.config import settings
    from app.models.base import Deal, Deck
    from app.services import analysis_service

    engine = create_engine(settings.database_url_sync, echo=False)

    with Session(engine) as session:
        deck = session.get(Deck, uuid.UUID(deck_id))
        if deck is None or not deck.extracted_text:
            return {"error": "deck not found or has no text"}

        deal = session.execute(
            sa_select(Deal).where(Deal.deck_id == uuid.UUID(deck_id))
        ).scalar_one_or_none()
        if deal is None:
            return {"error": "deal not found"}

        try:
            snapshot = analysis_service.triage(
                deck_text=deck.extracted_text,
                deal_id=str(deal.id),
                tenant_id=tenant_id,
            )
            deal.triage = snapshot
            session.commit()
        except Exception as exc:
            raise self.retry(exc=exc, countdown=30)

    return {"deck_id": deck_id, "status": "triaged"}


@celery_app.task(name="worker.process_deal_document", bind=True, max_retries=3)
def process_deal_document(self, document_id: str) -> dict[str, Any]:
    """Extract text from a supplementary deal document."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    from app.core.config import settings
    from app.models.deal_documents import DealDocument
    from app.services.document_parser import parse

    engine = create_engine(settings.database_url_sync, echo=False)

    with Session(engine) as session:
        doc = session.get(DealDocument, uuid.UUID(document_id))
        if doc is None:
            return {"error": "document not found"}

        try:
            file_bytes = _load_file(doc.storage_path)
            extracted = parse(file_bytes, doc.mime_type, doc.filename)
            doc.extracted_text = extracted.full_text
            session.commit()
        except Exception as exc:
            raise self.retry(exc=exc, countdown=30)

    return {"document_id": document_id, "status": "extracted"}


def _load_file(storage_path: str) -> bytes:
    """Load file bytes from storage. In dev, storage_path is an absolute local path."""
    import os

    if os.path.exists(storage_path):
        with open(storage_path, "rb") as f:
            return f.read()

    # Future: S3/OVH Object Storage download
    raise FileNotFoundError(f"File not found at {storage_path}")
