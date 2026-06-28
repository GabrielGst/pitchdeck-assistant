from collections.abc import Callable

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import verify_clerk_token
from app.core.database import get_db
from app.models.base import Role, User


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    token = auth_header.removeprefix("Bearer ")

    try:
        clerk_user_id = await verify_clerk_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    result = await db.execute(select(User).where(User.clerk_user_id == clerk_user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not provisioned — contact your administrator",
        )

    return user


def require_role(*roles: Role) -> Callable:
    """Dependency factory that enforces one of the given roles."""

    async def check(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=403,
                detail=f"Required role: {[r.value for r in roles]}",
            )
        return user

    return check
