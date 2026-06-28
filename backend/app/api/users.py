import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.base import Role, Tenant, User

router = APIRouter(prefix="/users", tags=["users"])


class TenantOut(BaseModel):
    id: uuid.UUID
    name: str
    slug: str


class MeOut(BaseModel):
    id: uuid.UUID
    email: str
    role: Role
    tenant: TenantOut


@router.get("/me", response_model=MeOut)
async def get_me(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MeOut:
    tenant = await db.get(Tenant, user.tenant_id)
    if tenant is None:
        raise HTTPException(status_code=500, detail="Tenant data inconsistency")

    return MeOut(
        id=user.id,
        email=user.email,
        role=user.role,
        tenant=TenantOut(id=tenant.id, name=tenant.name, slug=tenant.slug),
    )
