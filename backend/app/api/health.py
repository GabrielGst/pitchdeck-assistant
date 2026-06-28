from fastapi import APIRouter
from redis.asyncio import Redis
from sqlalchemy import text

from app.core.config import settings
from app.core.database import AsyncSessionLocal

router = APIRouter()


@router.get("/health")
async def health() -> dict[str, object]:
    services: dict[str, str] = {}

    # Database
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        services["database"] = "ok"
    except Exception as e:
        services["database"] = f"error: {e}"

    # Redis
    try:
        redis = Redis.from_url(settings.redis_url)
        await redis.ping()
        await redis.aclose()
        services["redis"] = "ok"
    except Exception as e:
        services["redis"] = f"error: {e}"

    # Celery (fire-and-forget ping — doesn't block the health check)
    try:
        from app.worker.tasks import ping
        ping.delay()
        services["celery"] = "ok"
    except Exception as e:
        services["celery"] = f"error: {e}"

    status = "healthy" if all(v == "ok" for v in services.values()) else "degraded"
    return {"status": status, "services": services, "environment": settings.environment}
