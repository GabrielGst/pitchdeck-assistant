"""
Thesis document management — Corpus B.

Only Admin users can upload / delete thesis documents.
Uploading triggers async Celery indexing into corpus_b_chunks.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_role
from app.core.database import get_db
from app.models.base import Role, User
from app.models.corpus import DocIndexStatus, ThesisDocument

router = APIRouter(prefix="/thesis", tags=["thesis"])

SUPPORTED_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    "text/markdown",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


class ThesisDocOut(BaseModel):
    id: uuid.UUID
    filename: str
    status: str
    created_at: str


@router.get("", response_model=list[ThesisDocOut])
async def list_thesis_docs(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ThesisDocOut]:
    """All users can list thesis documents for their tenant."""
    rows = await db.execute(
        select(ThesisDocument)
        .where(ThesisDocument.tenant_id == user.tenant_id)
        .order_by(ThesisDocument.created_at.desc())
    )
    docs = rows.scalars().all()
    return [
        ThesisDocOut(
            id=d.id,
            filename=d.filename,
            status=d.status.value,
            created_at=d.created_at.isoformat(),
        )
        for d in docs
    ]


@router.post("", response_model=ThesisDocOut, dependencies=[Depends(require_role(Role.admin))])
async def upload_thesis_doc(
    file: UploadFile,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ThesisDocOut:
    """Admin uploads a thesis document — triggers async indexing into corpus B."""
    if file.content_type not in SUPPORTED_TYPES:
        raise HTTPException(
            status_code=422,
            detail="Unsupported file type. Accepted: PDF, PPTX, DOCX, TXT, MD",
        )

    content = await file.read()
    storage_path = f"/tmp/pitchdeck-thesis/{user.tenant_id}/{file.filename}"
    import os
    os.makedirs(os.path.dirname(storage_path), exist_ok=True)
    with open(storage_path, "wb") as f:
        f.write(content)

    doc = ThesisDocument(
        tenant_id=user.tenant_id,
        filename=file.filename or "document",
        storage_path=storage_path,
        mime_type=file.content_type or "application/octet-stream",
        status=DocIndexStatus.pending,
        uploaded_by=user.id,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # Dispatch Celery task for async embedding
    from app.worker.tasks import index_thesis_document
    index_thesis_document.delay(str(doc.id), str(user.tenant_id))

    return ThesisDocOut(
        id=doc.id,
        filename=doc.filename,
        status=doc.status.value,
        created_at=doc.created_at.isoformat(),
    )


@router.delete("/{doc_id}", status_code=204, dependencies=[Depends(require_role(Role.admin))])
async def delete_thesis_doc(
    doc_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Admin deletes a thesis document and all its embeddings (cascade)."""
    doc = await db.get(ThesisDocument, doc_id)
    if doc is None or doc.tenant_id != user.tenant_id:
        raise HTTPException(status_code=404, detail="Document not found")

    import os
    try:
        os.remove(doc.storage_path)
    except FileNotFoundError:
        pass

    await db.delete(doc)
    await db.commit()
