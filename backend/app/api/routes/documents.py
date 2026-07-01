"""
Deal supplementary document upload/list/delete.
Text extraction is deferred to a Celery task.
"""

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.base import Deal, User
from app.models.deal_documents import DealDocument, DocumentType

UPLOAD_DIR = Path(settings.upload_dir)

ALLOWED_MIME = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "text/plain",
}

router = APIRouter(prefix="/deals", tags=["documents"])


class DocumentOut(BaseModel):
    id: uuid.UUID
    deal_id: uuid.UUID
    filename: str
    mime_type: str
    document_type: str
    has_text: bool
    created_at: str


def _to_out(doc: DealDocument) -> DocumentOut:
    return DocumentOut(
        id=doc.id,
        deal_id=doc.deal_id,
        filename=doc.filename,
        mime_type=doc.mime_type,
        document_type=doc.document_type.value,
        has_text=doc.extracted_text is not None,
        created_at=doc.created_at.isoformat(),
    )


@router.post("/{deal_id}/documents", response_model=DocumentOut)
async def upload_document(
    deal_id: uuid.UUID,
    file: UploadFile = File(...),
    document_type: DocumentType = DocumentType.supplementary,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DocumentOut:
    deal = await db.get(Deal, deal_id)
    if deal is None or deal.tenant_id != user.tenant_id:
        raise HTTPException(status_code=404, detail="Deal not found")

    mime = file.content_type or ""
    if mime not in ALLOWED_MIME:
        raise HTTPException(status_code=422, detail=f"Unsupported file type: {mime}")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    file_id = uuid.uuid4()
    storage_path = str(UPLOAD_DIR / f"doc_{file_id}_{file.filename}")

    contents = await file.read()
    with open(storage_path, "wb") as f:
        f.write(contents)

    doc = DealDocument(
        deal_id=deal_id,
        tenant_id=user.tenant_id,
        filename=file.filename or "document",
        storage_path=storage_path,
        mime_type=mime,
        document_type=document_type,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    from app.worker.tasks import process_deal_document
    process_deal_document.delay(str(doc.id))

    return _to_out(doc)


@router.get("/{deal_id}/documents", response_model=list[DocumentOut])
async def list_documents(
    deal_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[DocumentOut]:
    deal = await db.get(Deal, deal_id)
    if deal is None or deal.tenant_id != user.tenant_id:
        raise HTTPException(status_code=404, detail="Deal not found")

    result = await db.execute(
        select(DealDocument)
        .where(DealDocument.deal_id == deal_id)
        .order_by(DealDocument.created_at.asc())
    )
    return [_to_out(doc) for doc in result.scalars().all()]


@router.delete("/{deal_id}/documents/{doc_id}", status_code=204)
async def delete_document(
    deal_id: uuid.UUID,
    doc_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    deal = await db.get(Deal, deal_id)
    if deal is None or deal.tenant_id != user.tenant_id:
        raise HTTPException(status_code=404, detail="Deal not found")

    doc = await db.get(DealDocument, doc_id)
    if doc is None or doc.deal_id != deal_id:
        raise HTTPException(status_code=404, detail="Document not found")

    import os
    try:
        os.remove(doc.storage_path)
    except FileNotFoundError:
        pass

    await db.delete(doc)
    await db.commit()
