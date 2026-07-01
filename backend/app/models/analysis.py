import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class AnalysisStatus(enum.StrEnum):
    pending = "pending"
    complete = "complete"
    failed = "failed"


class RiskLevel(enum.StrEnum):
    low = "low"
    medium = "medium"
    high = "high"


UNIVERSAL_DIMENSIONS = [
    "team",
    "market_size",
    "traction",
    "business_model",
    "competition",
    "financials",
    "overall",
]


class AnalysisResult(Base):
    __tablename__ = "analysis_results"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    deal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("deals.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[AnalysisStatus] = mapped_column(
        Enum(AnalysisStatus), nullable=False, default=AnalysisStatus.pending
    )
    memo_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    memo_edited_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    partner_memo: Mapped[str | None] = mapped_column(Text, nullable=True)
    llm_model: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    scores: Mapped[list["ScorecardScore"]] = relationship(
        "ScorecardScore", back_populates="analysis", cascade="all, delete-orphan"
    )
    dd_questions: Mapped[list["DDQuestion"]] = relationship(
        "DDQuestion", back_populates="analysis", cascade="all, delete-orphan", order_by="DDQuestion.position"
    )
    memo_edits: Mapped[list["MemoEdit"]] = relationship(
        "MemoEdit", back_populates="analysis", cascade="all, delete-orphan"
    )


class ScorecardScore(Base):
    __tablename__ = "scorecard_scores"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    analysis_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("analysis_results.id", ondelete="CASCADE"), nullable=False
    )
    dimension_key: Mapped[str] = mapped_column(String(100), nullable=False)
    ai_score: Mapped[int] = mapped_column(Integer, nullable=False)
    human_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rationale: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_custom: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    analysis: Mapped["AnalysisResult"] = relationship("AnalysisResult", back_populates="scores")


class DDQuestion(Base):
    __tablename__ = "dd_questions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    analysis_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("analysis_results.id", ondelete="CASCADE"), nullable=False
    )
    question: Mapped[str] = mapped_column(Text, nullable=False)
    edited_question: Mapped[str | None] = mapped_column(Text, nullable=True)
    risk_level: Mapped[RiskLevel] = mapped_column(
        Enum(RiskLevel), nullable=False, default=RiskLevel.medium
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    answer: Mapped[str | None] = mapped_column(Text, nullable=True)

    analysis: Mapped["AnalysisResult"] = relationship("AnalysisResult", back_populates="dd_questions")


class MemoEdit(Base):
    __tablename__ = "memo_edits"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    analysis_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("analysis_results.id", ondelete="CASCADE"), nullable=False
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    original_text: Mapped[str] = mapped_column(Text, nullable=False)
    edited_text: Mapped[str] = mapped_column(Text, nullable=False)
    section: Mapped[str] = mapped_column(String(50), nullable=False, default="memo")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    analysis: Mapped["AnalysisResult"] = relationship("AnalysisResult", back_populates="memo_edits")
