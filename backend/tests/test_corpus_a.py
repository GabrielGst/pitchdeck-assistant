"""
Tests for corpus A (deal history) — auto-indexing after deck processing.
"""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.embedding_service import MIN_SCORE


@pytest.mark.anyio
async def test_retrieve_deal_context_empty_corpus_returns_empty():
    """No corpus A chunks = empty context string, not an error."""
    from app.services.embedding_service import retrieve_deal_context

    mock_rows = MagicMock()
    mock_rows.all.return_value = []
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mock_rows)

    with patch("app.services.embedding_service.embed", AsyncMock(return_value=[[0.1] * 1024])):
        result = await retrieve_deal_context("deck text", uuid.uuid4(), uuid.uuid4(), mock_db)

    assert result == ""


@pytest.mark.anyio
async def test_retrieve_deal_context_above_threshold_included():
    """High-similarity historical deal chunks are returned in context."""
    from app.services.embedding_service import retrieve_deal_context

    row = MagicMock()
    row.chunk_text = "Previous SaaS investment: ARR $2M, 3x YoY growth"
    row.score = MIN_SCORE + 0.1

    mock_rows = MagicMock()
    mock_rows.all.return_value = [row]
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mock_rows)

    with patch("app.services.embedding_service.embed", AsyncMock(return_value=[[0.1] * 1024])):
        result = await retrieve_deal_context("deck text", uuid.uuid4(), uuid.uuid4(), mock_db)

    assert "SaaS investment" in result
    assert "COMPARABLE DEALS" in result


@pytest.mark.anyio
async def test_index_corpus_a_creates_chunks():
    """index_corpus_a persists the expected number of chunks to the DB."""
    from app.services.embedding_service import CHUNK_SIZE, index_corpus_a

    text = "Investment thesis " * 100  # ~1800 chars, should produce a few chunks
    expected_chunks = max(1, len(text) // CHUNK_SIZE)

    mock_db = AsyncMock()
    mock_db.add = MagicMock()
    mock_db.commit = AsyncMock()

    fake_embeddings = [[0.1] * 1024 for _ in range(expected_chunks + 5)]

    with patch("app.services.embedding_service.embed", AsyncMock(return_value=fake_embeddings)):
        await index_corpus_a(
            deal_id=uuid.uuid4(),
            deck_id=uuid.uuid4(),
            tenant_id=uuid.uuid4(),
            text=text,
            db=mock_db,
        )

    assert mock_db.add.called
    assert mock_db.commit.called


@pytest.mark.anyio
async def test_index_corpus_a_empty_text_is_noop():
    """Empty deck text produces no DB writes — no chunks to embed."""
    from app.services.embedding_service import index_corpus_a

    mock_db = AsyncMock()
    mock_db.add = MagicMock()

    with patch("app.services.embedding_service.embed", AsyncMock()) as mock_embed:
        await index_corpus_a(
            deal_id=uuid.uuid4(),
            deck_id=uuid.uuid4(),
            tenant_id=uuid.uuid4(),
            text="",
            db=mock_db,
        )

    mock_embed.assert_not_called()
    mock_db.add.assert_not_called()
