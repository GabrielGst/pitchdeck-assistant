"""
Per-tenant scorecard configuration — Admin-only.

Admins define custom scoring dimensions (key, label, description) which are
persisted in tenant_configs.custom_scorecard_dims and injected into every
scorecard generation prompt for that tenant.
"""

import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_role
from app.core.database import get_db
from app.models.base import Role, User
from app.models.pipeline import TenantConfig

router = APIRouter(prefix="/scorecard-config", tags=["scorecard"])

_KEY_RE = re.compile(r"^[a-z][a-z0-9_]{1,49}$")


class ScorecardDim(BaseModel):
    key: str
    label: str
    description: str = ""

    @field_validator("key")
    @classmethod
    def key_must_be_snake_case(cls, v: str) -> str:
        if not _KEY_RE.match(v):
            raise ValueError("key must be lowercase snake_case, 2–50 chars, starting with a letter")
        return v


class ScorecardConfigOut(BaseModel):
    custom_dims: list[ScorecardDim]


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


@router.get("", response_model=ScorecardConfigOut)
async def get_scorecard_config(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ScorecardConfigOut:
    """All users can view the tenant's custom scorecard dimensions."""
    cfg = await _get_or_create_config(user.tenant_id, db)
    return ScorecardConfigOut(
        custom_dims=[ScorecardDim(**d) for d in (cfg.custom_scorecard_dims or [])]
    )


@router.put("", response_model=ScorecardConfigOut, dependencies=[Depends(require_role(Role.admin))])
async def set_scorecard_config(
    body: ScorecardConfigOut,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ScorecardConfigOut:
    """Admin replaces the full list of custom scorecard dimensions."""
    from app.models.analysis import UNIVERSAL_DIMENSIONS

    reserved = {d.key for d in body.custom_dims} & set(UNIVERSAL_DIMENSIONS)
    if reserved:
        raise HTTPException(
            status_code=422,
            detail=f"Keys {sorted(reserved)} conflict with built-in dimensions",
        )

    if len(body.custom_dims) > 10:
        raise HTTPException(status_code=422, detail="Maximum 10 custom dimensions")

    cfg = await _get_or_create_config(user.tenant_id, db)
    cfg.custom_scorecard_dims = [d.model_dump() for d in body.custom_dims]
    await db.commit()
    await db.refresh(cfg)

    return ScorecardConfigOut(
        custom_dims=[ScorecardDim(**d) for d in (cfg.custom_scorecard_dims or [])]
    )
