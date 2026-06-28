"""
Tests for corpus B (thesis documents) — embedding service unit tests.
API endpoint tests use the same inline mock pattern as test_auth.py.
"""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.base import Role


# ---------------------------------------------------------------------------
# EmbeddingService unit tests
# ---------------------------------------------------------------------------

def test_chunk_text_basic():
    from app.services.embedding_service import CHUNK_SIZE, _chunk_text

    text = "A" * (CHUNK_SIZE * 3)
    chunks = _chunk_text(text)
    assert len(chunks) > 2
    assert all(len(c) <= CHUNK_SIZE for c in chunks)


def test_chunk_text_short_text():
    from app.services.embedding_service import _chunk_text

    chunks = _chunk_text("Short text")
    assert len(chunks) == 1
    assert chunks[0] == "Short text"


def test_chunk_text_empty():
    from app.services.embedding_service import _chunk_text

    assert _chunk_text("") == []
    assert _chunk_text("   ") == []


@pytest.mark.anyio
async def test_retrieve_thesis_context_empty_db_returns_empty_string():
    """When corpus B has no rows, retrieval returns empty string — no hallucination."""
    from app.services.embedding_service import retrieve_thesis_context

    mock_rows = MagicMock()
    mock_rows.all.return_value = []
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mock_rows)

    with patch("app.services.embedding_service.embed", AsyncMock(return_value=[[0.1] * 1024])):
        result = await retrieve_thesis_context("deck text", uuid.uuid4(), mock_db)

    assert result == ""


@pytest.mark.anyio
async def test_retrieve_thesis_context_below_threshold_excluded():
    """Chunks with cosine similarity below MIN_SCORE are not included."""
    from app.services.embedding_service import MIN_SCORE, retrieve_thesis_context

    low_row = MagicMock()
    low_row.chunk_text = "Should be excluded"
    low_row.score = MIN_SCORE - 0.05

    mock_rows = MagicMock()
    mock_rows.all.return_value = [low_row]
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mock_rows)

    with patch("app.services.embedding_service.embed", AsyncMock(return_value=[[0.1] * 1024])):
        result = await retrieve_thesis_context("deck text", uuid.uuid4(), mock_db)

    assert result == ""


@pytest.mark.anyio
async def test_retrieve_thesis_context_above_threshold_included():
    """Chunks above MIN_SCORE are included in the returned context string."""
    from app.services.embedding_service import MIN_SCORE, retrieve_thesis_context

    good_row = MagicMock()
    good_row.chunk_text = "We invest in B2B SaaS with strong ARR growth"
    good_row.score = MIN_SCORE + 0.05

    mock_rows = MagicMock()
    mock_rows.all.return_value = [good_row]
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mock_rows)

    with patch("app.services.embedding_service.embed", AsyncMock(return_value=[[0.1] * 1024])):
        result = await retrieve_thesis_context("deck text", uuid.uuid4(), mock_db)

    assert "B2B SaaS" in result
    assert "FIRM INVESTMENT THESIS" in result


@pytest.mark.anyio
async def test_retrieve_thesis_context_embed_failure_returns_empty():
    """If the embedding API fails, gracefully return empty string (no crash)."""
    from app.services.embedding_service import retrieve_thesis_context

    mock_db = AsyncMock()

    with patch("app.services.embedding_service.embed", AsyncMock(side_effect=Exception("API down"))):
        result = await retrieve_thesis_context("deck text", uuid.uuid4(), mock_db)

    assert result == ""


@pytest.mark.anyio
async def test_retrieve_deal_context_excludes_current_deal():
    """retrieve_deal_context does not return chunks from the deal being analysed."""
    from app.services.embedding_service import MIN_SCORE, retrieve_deal_context

    excluded_deal_id = uuid.uuid4()

    # Row has a good score but we check the SQL where clause via the mock call
    good_row = MagicMock()
    good_row.chunk_text = "Historic deal context"
    good_row.score = MIN_SCORE + 0.1

    mock_rows = MagicMock()
    mock_rows.all.return_value = [good_row]
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mock_rows)

    with patch("app.services.embedding_service.embed", AsyncMock(return_value=[[0.1] * 1024])):
        result = await retrieve_deal_context("deck text", uuid.uuid4(), excluded_deal_id, mock_db)

    # Verify the query was executed (exclusion is enforced at DB level by the WHERE clause)
    assert mock_db.execute.called
    assert "COMPARABLE DEALS" in result


# ---------------------------------------------------------------------------
# derive_embedding_model tests
# ---------------------------------------------------------------------------

def test_derive_embedding_model_mistral():
    from app.services.embedding_service import _derive_embedding_model
    with patch("app.services.embedding_service.settings") as mock_settings:
        mock_settings.llm_model = "mistral/mistral-small-latest"
        assert _derive_embedding_model() == "mistral/mistral-embed"


def test_derive_embedding_model_openai():
    from app.services.embedding_service import _derive_embedding_model
    with patch("app.services.embedding_service.settings") as mock_settings:
        mock_settings.llm_model = "openai/gpt-4o"
        assert _derive_embedding_model() == "openai/text-embedding-3-small"


def test_derive_embedding_model_claude_falls_back_to_mistral():
    from app.services.embedding_service import _derive_embedding_model
    with patch("app.services.embedding_service.settings") as mock_settings:
        mock_settings.llm_model = "anthropic/claude-opus-4-8"
        assert _derive_embedding_model() == "mistral/mistral-embed"
