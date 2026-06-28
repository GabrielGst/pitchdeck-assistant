import uuid

from app.worker.celery_app import celery_app


@celery_app.task(name="worker.ping")
def ping() -> str:
    return "pong"


@celery_app.task(name="worker.process_deck", bind=True, max_retries=3)
def process_deck(self, deck_id: str, tenant_id: str) -> dict:  # type: ignore[misc]
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

    # Publish extraction complete event so the SSE endpoint can begin streaming
    r = redis.Redis.from_url(settings.redis_url)
    r.publish(f"deck:{deck_id}:status", "EXTRACTION_COMPLETE")
    r.close()

    return {"deck_id": deck_id, "status": "processed"}


@celery_app.task(name="worker.index_thesis_document", bind=True, max_retries=3)
def index_thesis_document(self, document_id: str, tenant_id: str) -> dict:  # type: ignore[misc]
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


def _load_file(storage_path: str) -> bytes:
    """Load file bytes from storage. In dev, storage_path is an absolute local path."""
    import os

    if os.path.exists(storage_path):
        with open(storage_path, "rb") as f:
            return f.read()

    # Future: S3/OVH Object Storage download
    raise FileNotFoundError(f"File not found at {storage_path}")
