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


def _load_file(storage_path: str) -> bytes:
    """Load file bytes from storage. In dev, storage_path is an absolute local path."""
    import os

    if os.path.exists(storage_path):
        with open(storage_path, "rb") as f:
            return f.read()

    # Future: S3/OVH Object Storage download
    raise FileNotFoundError(f"File not found at {storage_path}")
