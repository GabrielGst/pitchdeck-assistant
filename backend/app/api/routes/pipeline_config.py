"""
Pipeline stage configuration — Admin-only writes, all users can read.

Admins rename universal stage display names and add up to 3 custom stages
that appear between Partner Review and the terminal states.  Stage keys
(INBOX, SCREENING, etc.) remain immutable in the database; only display names
and ordering of custom stages are managed here.
"""

import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_role
from app.core.database import get_db
from app.models.base import Deal, DealStage, Role, User
from app.models.pipeline import TenantConfig

router = APIRouter(prefix="/pipeline-config", tags=["pipeline"])

_KEY_RE = re.compile(r"^[a-z][a-z0-9_]{1,49}$")

UNIVERSAL_STAGE_KEYS = [
    DealStage.inbox.value,
    DealStage.screening.value,
    DealStage.due_diligence.value,
    DealStage.partner_review.value,
    DealStage.invested.value,
    DealStage.passed.value,
]

DEFAULT_LABELS: dict[str, str] = {
    "inbox": "Inbox",
    "screening": "Screening",
    "due_diligence": "Due Diligence",
    "partner_review": "Partner Review",
    "invested": "Invested",
    "passed": "Passed",
}

MAX_CUSTOM_STAGES = 3


class CustomStage(BaseModel):
    key: str = Field(..., max_length=50)
    label: str = Field(..., min_length=1, max_length=100)

    @field_validator("key")
    @classmethod
    def key_must_be_snake_case(cls, v: str) -> str:
        if not _KEY_RE.match(v):
            raise ValueError("key must be lowercase snake_case, 2–50 chars, starting with a letter")
        if v in UNIVERSAL_STAGE_KEYS:
            raise ValueError(f"'{v}' is a reserved stage key")
        return v


class PipelineConfigIn(BaseModel):
    stage_labels: dict[str, str] = Field(default_factory=dict)
    custom_stages: list[CustomStage] = Field(default_factory=list, max_length=3)


class PipelineConfigOut(BaseModel):
    stage_order: list[str]
    stage_labels: dict[str, str]
    custom_stages: list[CustomStage]


async def _get_or_create_config(tenant_id: Any, db: AsyncSession) -> TenantConfig:
    result = await db.execute(
        select(TenantConfig).where(TenantConfig.tenant_id == tenant_id)
    )
    cfg = result.scalar_one_or_none()
    if cfg is None:
        cfg = TenantConfig(tenant_id=tenant_id)
        db.add(cfg)
        await db.commit()
        await db.refresh(cfg)
    return cfg


def _build_config_out(cfg: TenantConfig) -> PipelineConfigOut:
    custom_stages = [CustomStage(**s) for s in (cfg.custom_stages or [])]
    labels = dict(DEFAULT_LABELS)
    labels.update(cfg.stage_labels or {})
    for cs in custom_stages:
        if cs.key not in labels:
            labels[cs.key] = cs.label

    pre_terminal = [
        DealStage.inbox.value,
        DealStage.screening.value,
        DealStage.due_diligence.value,
        DealStage.partner_review.value,
    ]
    custom_keys = [cs.key for cs in custom_stages]
    terminal = [DealStage.invested.value, DealStage.passed.value]
    stage_order = pre_terminal + custom_keys + terminal

    return PipelineConfigOut(
        stage_order=stage_order,
        stage_labels=labels,
        custom_stages=custom_stages,
    )


@router.get("", response_model=PipelineConfigOut)
async def get_pipeline_config(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PipelineConfigOut:
    cfg = await _get_or_create_config(user.tenant_id, db)
    return _build_config_out(cfg)


@router.put("", response_model=PipelineConfigOut, dependencies=[Depends(require_role(Role.admin))])
async def set_pipeline_config(
    body: PipelineConfigIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PipelineConfigOut:
    if len(body.custom_stages) > MAX_CUSTOM_STAGES:
        raise HTTPException(status_code=422, detail=f"Maximum {MAX_CUSTOM_STAGES} custom stages")

    # Validate label overrides only apply to known keys
    known_keys = set(UNIVERSAL_STAGE_KEYS) | {cs.key for cs in body.custom_stages}
    bad = set(body.stage_labels) - known_keys
    if bad:
        raise HTTPException(status_code=422, detail=f"Unknown stage keys: {sorted(bad)}")

    cfg = await _get_or_create_config(user.tenant_id, db)
    old_custom_keys = {s["key"] for s in (cfg.custom_stages or [])}
    new_custom_keys = {cs.key for cs in body.custom_stages}
    removed_keys = old_custom_keys - new_custom_keys

    # Move deals from removed custom stages back to partner_review
    if removed_keys:
        await db.execute(
            update(Deal)
            .where(Deal.tenant_id == user.tenant_id)
            .where(Deal.custom_stage.in_(removed_keys))
            .values(custom_stage=None)
        )

    cfg.stage_labels = dict(body.stage_labels)
    cfg.custom_stages = [cs.model_dump() for cs in body.custom_stages]
    await db.commit()
    await db.refresh(cfg)

    return _build_config_out(cfg)
