"""
Partner review: rating + comments.
POST/GET /deals/{deal_id}/review   — upsert/fetch partner review
POST     /deals/{deal_id}/comments — create a comment
PATCH    /deals/{deal_id}/comments/{comment_id} — edit comment
DELETE   /deals/{deal_id}/comments/{comment_id} — delete comment
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.base import Deal, User
from app.models.review import PartnerReview, ReviewComment, ReviewRating

router = APIRouter(prefix="/deals", tags=["review"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class ReviewIn(BaseModel):
    rating: ReviewRating | None = None
    summary: str | None = None


class ReviewOut(BaseModel):
    id: uuid.UUID
    deal_id: uuid.UUID
    reviewer_id: uuid.UUID
    rating: str | None
    summary: str | None
    updated_at: str


class CommentIn(BaseModel):
    body: str
    ai_assisted: bool = False
    context_ref: str | None = None


class CommentPatch(BaseModel):
    body: str | None = None


class CommentOut(BaseModel):
    id: uuid.UUID
    deal_id: uuid.UUID
    author_id: uuid.UUID | None
    body: str
    ai_assisted: bool
    context_ref: str | None
    created_at: str
    updated_at: str


def _review_out(r: PartnerReview) -> ReviewOut:
    return ReviewOut(
        id=r.id,
        deal_id=r.deal_id,
        reviewer_id=r.reviewer_id,
        rating=r.rating.value if r.rating else None,
        summary=r.summary,
        updated_at=r.updated_at.isoformat(),
    )


def _comment_out(c: ReviewComment) -> CommentOut:
    return CommentOut(
        id=c.id,
        deal_id=c.deal_id,
        author_id=c.author_id,
        body=c.body,
        ai_assisted=c.ai_assisted,
        context_ref=c.context_ref,
        created_at=c.created_at.isoformat(),
        updated_at=c.updated_at.isoformat(),
    )


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("/{deal_id}/review", response_model=ReviewOut)
async def upsert_review(
    deal_id: uuid.UUID,
    body: ReviewIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReviewOut:
    deal = await db.get(Deal, deal_id)
    if deal is None or deal.tenant_id != user.tenant_id:
        raise HTTPException(status_code=404, detail="Deal not found")

    result = await db.execute(
        select(PartnerReview)
        .where(PartnerReview.deal_id == deal_id, PartnerReview.reviewer_id == user.id)
    )
    review = result.scalar_one_or_none()

    if review is None:
        review = PartnerReview(
            deal_id=deal_id,
            tenant_id=user.tenant_id,
            reviewer_id=user.id,
        )
        db.add(review)

    if body.rating is not None:
        review.rating = body.rating
    if body.summary is not None:
        review.summary = body.summary

    await db.commit()
    await db.refresh(review)
    return _review_out(review)


@router.get("/{deal_id}/review")
async def get_review(
    deal_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    deal = await db.get(Deal, deal_id)
    if deal is None or deal.tenant_id != user.tenant_id:
        raise HTTPException(status_code=404, detail="Deal not found")

    reviews_result = await db.execute(
        select(PartnerReview).where(PartnerReview.deal_id == deal_id)
    )
    reviews = [_review_out(r) for r in reviews_result.scalars().all()]

    comments_result = await db.execute(
        select(ReviewComment)
        .where(ReviewComment.deal_id == deal_id)
        .order_by(ReviewComment.created_at.asc())
    )
    comments = [_comment_out(c) for c in comments_result.scalars().all()]

    return {"reviews": [r.model_dump() for r in reviews], "comments": [c.model_dump() for c in comments]}


@router.post("/{deal_id}/comments", response_model=CommentOut)
async def create_comment(
    deal_id: uuid.UUID,
    body: CommentIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CommentOut:
    deal = await db.get(Deal, deal_id)
    if deal is None or deal.tenant_id != user.tenant_id:
        raise HTTPException(status_code=404, detail="Deal not found")

    comment = ReviewComment(
        deal_id=deal_id,
        tenant_id=user.tenant_id,
        author_id=user.id,
        body=body.body,
        ai_assisted=body.ai_assisted,
        context_ref=body.context_ref,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return _comment_out(comment)


@router.patch("/{deal_id}/comments/{comment_id}", response_model=CommentOut)
async def update_comment(
    deal_id: uuid.UUID,
    comment_id: uuid.UUID,
    body: CommentPatch,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CommentOut:
    deal = await db.get(Deal, deal_id)
    if deal is None or deal.tenant_id != user.tenant_id:
        raise HTTPException(status_code=404, detail="Deal not found")

    comment = await db.get(ReviewComment, comment_id)
    if comment is None or comment.deal_id != deal_id:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.author_id != user.id:
        raise HTTPException(status_code=403, detail="Not your comment")

    if body.body is not None:
        comment.body = body.body

    await db.commit()
    await db.refresh(comment)
    return _comment_out(comment)


@router.delete("/{deal_id}/comments/{comment_id}", status_code=204)
async def delete_comment(
    deal_id: uuid.UUID,
    comment_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    deal = await db.get(Deal, deal_id)
    if deal is None or deal.tenant_id != user.tenant_id:
        raise HTTPException(status_code=404, detail="Deal not found")

    comment = await db.get(ReviewComment, comment_id)
    if comment is None or comment.deal_id != deal_id:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.author_id != user.id:
        raise HTTPException(status_code=403, detail="Not your comment")

    await db.delete(comment)
    await db.commit()
