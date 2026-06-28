import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_role
from app.core.database import get_db
from app.models.base import Role, User

router = APIRouter(prefix="/team", tags=["team"])


class InviteRequest(BaseModel):
    clerk_user_id: str
    email: EmailStr
    role: Role


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    role: str
    created_at: datetime


@router.get("", response_model=list[UserOut])
async def list_team(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[UserOut]:
    result = await db.execute(select(User).where(User.tenant_id == user.tenant_id))
    members = result.scalars().all()
    return [UserOut(id=m.id, email=m.email, role=m.role.value, created_at=m.created_at) for m in members]


@router.post("", response_model=UserOut, status_code=201, dependencies=[Depends(require_role(Role.admin))])
async def invite_member(
    body: InviteRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    existing = await db.execute(select(User).where(User.clerk_user_id == body.clerk_user_id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="This Clerk user ID is already provisioned")

    new_user = User(
        tenant_id=user.tenant_id,
        clerk_user_id=body.clerk_user_id,
        email=str(body.email),
        role=body.role,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return UserOut(id=new_user.id, email=new_user.email, role=new_user.role.value, created_at=new_user.created_at)


@router.delete("/{user_id}", status_code=204, dependencies=[Depends(require_role(Role.admin))])
async def remove_member(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    target = await db.get(User, user_id)
    if target is None or target.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == current_user.id:
        raise HTTPException(status_code=409, detail="Cannot remove yourself")
    await db.delete(target)
    await db.commit()
