import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.base import Deal, DealStage, Deck, DeckStatus, User
from app.services.document_parser import SUPPORTED_MIME_TYPES

router = APIRouter(prefix="/decks", tags=["decks"])

UPLOAD_DIR = Path(settings.upload_dir)

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


class DeckOut(BaseModel):
    id: uuid.UUID
    filename: str
    status: str
    deal_id: uuid.UUID


@router.post("", response_model=DeckOut, status_code=201)
async def upload_deck(
    file: UploadFile,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DeckOut:
    if file.content_type not in SUPPORTED_MIME_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported file type '{file.content_type}'. Upload a PDF or PPTX.",
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds 50 MB limit")

    # Store locally (dev) — S3 path in prod
    file_id = uuid.uuid4()
    storage_path = str(UPLOAD_DIR / f"{file_id}_{file.filename}")
    with open(storage_path, "wb") as f:
        f.write(file_bytes)

    # Persist Deck record
    deck = Deck(
        tenant_id=user.tenant_id,
        filename=file.filename or "unnamed",
        storage_path=storage_path,
        mime_type=file.content_type,
        status=DeckStatus.pending,
    )
    db.add(deck)
    await db.flush()

    # Auto-create Deal in INBOX stage
    company_name = Path(file.filename or "unnamed").stem
    deal = Deal(
        tenant_id=user.tenant_id,
        deck_id=deck.id,
        company_name=company_name,
        stage=DealStage.inbox,
    )
    db.add(deal)
    await db.commit()
    await db.refresh(deck)
    await db.refresh(deal)

    # Dispatch async extraction task
    from app.worker.tasks import process_deck
    process_deck.delay(str(deck.id), str(user.tenant_id))

    return DeckOut(id=deck.id, filename=deck.filename, status=deck.status.value, deal_id=deal.id)
