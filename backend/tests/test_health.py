import pytest
from httpx import ASGITransport, AsyncClient
from unittest.mock import AsyncMock, patch

from app.main import app


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


async def test_health_returns_200(client: AsyncClient) -> None:
    with (
        patch("app.api.health.AsyncSessionLocal") as mock_session_factory,
        patch("app.api.health.Redis") as mock_redis_class,
        patch("app.api.health.ping") as mock_ping,
    ):
        mock_session = AsyncMock()
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=None)
        mock_session.execute = AsyncMock()
        mock_session_factory.return_value = mock_session

        mock_redis = AsyncMock()
        mock_redis.ping = AsyncMock()
        mock_redis.aclose = AsyncMock()
        mock_redis_class.from_url.return_value = mock_redis

        mock_ping.delay = AsyncMock()

        response = await client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] in ("healthy", "degraded")
    assert "services" in body
    assert "database" in body["services"]
    assert "redis" in body["services"]
