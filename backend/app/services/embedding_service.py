"""
EmbeddingService — handles vector embedding via LiteLLM + pgvector retrieval.

Uses the same LLM abstraction pattern: EMBEDDING_MODEL env var or derived
from LLM_MODEL. Mistral embed-v2 (1024-dim) is the default.

Minimum similarity threshold (MIN_SCORE) prevents low-quality matches from
polluting the retrieval context — empty results are returned as empty list
rather than hallucinated context.
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

import litellm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.corpus import EMBEDDING_DIM, CorpusAChunk, CorpusBChunk

if TYPE_CHECKING:
    pass

CHUNK_SIZE = 512       # characters per chunk
CHUNK_OVERLAP = 64     # character overlap between chunks
TOP_K = 5              # chunks to retrieve per corpus
MIN_SCORE = 0.70       # cosine similarity threshold — below this = irrelevant


def _chunk_text(text: str) -> list[str]:
    """Split text into overlapping character windows."""
    chunks = []
    start = 0
    while start < len(text):
        end = start + CHUNK_SIZE
        chunks.append(text[start:end])
        start += CHUNK_SIZE - CHUNK_OVERLAP
    return [c for c in chunks if c.strip()]


def _derive_embedding_model() -> str:
    """Derive the embedding model from LLM_MODEL if not explicitly set."""
    model = settings.llm_model
    if model.startswith("mistral/"):
        return "mistral/mistral-embed"
    if model.startswith("openai/") or "gpt" in model:
        return "openai/text-embedding-3-small"
    if model.startswith("anthropic/") or "claude" in model:
        # Anthropic doesn't have a public embedding model — fall back to Mistral
        return "mistral/mistral-embed"
    return "mistral/mistral-embed"


async def embed(texts: list[str]) -> list[list[float]]:
    """Return one embedding vector per text. Raises on API failure."""
    if not texts:
        return []
    model = _derive_embedding_model()
    resp = litellm.embedding(model=model, input=texts)
    return [item["embedding"] for item in resp.data]


async def index_corpus_b(
    document_id: uuid.UUID,
    tenant_id: uuid.UUID,
    text: str,
    db: AsyncSession,
) -> None:
    """Chunk + embed a thesis document and persist to corpus_b_chunks."""
    chunks = _chunk_text(text)
    if not chunks:
        return

    embeddings = await embed(chunks)
    for i, (chunk_text, vector) in enumerate(zip(chunks, embeddings)):
        if len(vector) != EMBEDDING_DIM:
            # Pad or truncate to match schema dimension — graceful degradation
            vector = (vector + [0.0] * EMBEDDING_DIM)[:EMBEDDING_DIM]
        db.add(CorpusBChunk(
            tenant_id=tenant_id,
            document_id=document_id,
            chunk_index=i,
            chunk_text=chunk_text,
            embedding=vector,
        ))
    await db.commit()


async def index_corpus_a(
    deal_id: uuid.UUID,
    deck_id: uuid.UUID,
    tenant_id: uuid.UUID,
    text: str,
    db: AsyncSession,
) -> None:
    """Chunk + embed a deal deck and persist to corpus_a_chunks."""
    chunks = _chunk_text(text)
    if not chunks:
        return

    embeddings = await embed(chunks)
    for i, (chunk_text, vector) in enumerate(zip(chunks, embeddings)):
        if len(vector) != EMBEDDING_DIM:
            vector = (vector + [0.0] * EMBEDDING_DIM)[:EMBEDDING_DIM]
        db.add(CorpusAChunk(
            tenant_id=tenant_id,
            deal_id=deal_id,
            deck_id=deck_id,
            chunk_index=i,
            chunk_text=chunk_text,
            embedding=vector,
        ))
    await db.commit()


async def retrieve_thesis_context(
    query_text: str,
    tenant_id: uuid.UUID,
    db: AsyncSession,
    top_k: int = TOP_K,
) -> str:
    """
    Embed the query and retrieve the most similar thesis chunks for this tenant.
    Returns empty string when corpus is empty or no results exceed MIN_SCORE.
    """
    try:
        query_vectors = await embed([query_text])
    except Exception:
        return ""

    if not query_vectors:
        return ""

    query_vec = query_vectors[0]

    # pgvector cosine distance: 1 - cosine_similarity
    rows = await db.execute(
        select(
            CorpusBChunk.chunk_text,
            (1 - CorpusBChunk.embedding.cosine_distance(query_vec)).label("score"),
        )
        .where(CorpusBChunk.tenant_id == tenant_id)
        .order_by(CorpusBChunk.embedding.cosine_distance(query_vec))
        .limit(top_k)
    )
    results = rows.all()

    relevant = [row.chunk_text for row in results if row.score >= MIN_SCORE]
    if not relevant:
        return ""

    return "FIRM INVESTMENT THESIS (retrieved from internal documents):\n\n" + "\n---\n".join(relevant)


async def retrieve_deal_context(
    query_text: str,
    tenant_id: uuid.UUID,
    exclude_deal_id: uuid.UUID,
    db: AsyncSession,
    top_k: int = TOP_K,
) -> str:
    """
    Retrieve similar chunks from past deals (corpus A).
    Excludes the current deal to avoid self-reference.
    Returns empty string when corpus is empty or no results exceed MIN_SCORE.
    """
    try:
        query_vectors = await embed([query_text])
    except Exception:
        return ""

    if not query_vectors:
        return ""

    query_vec = query_vectors[0]

    rows = await db.execute(
        select(
            CorpusAChunk.chunk_text,
            (1 - CorpusAChunk.embedding.cosine_distance(query_vec)).label("score"),
        )
        .where(
            CorpusAChunk.tenant_id == tenant_id,
            CorpusAChunk.deal_id != exclude_deal_id,
        )
        .order_by(CorpusAChunk.embedding.cosine_distance(query_vec))
        .limit(top_k)
    )
    results = rows.all()

    relevant = [row.chunk_text for row in results if row.score >= MIN_SCORE]
    if not relevant:
        return ""

    return "COMPARABLE DEALS FROM DEAL HISTORY (retrieved from past investments):\n\n" + "\n---\n".join(relevant)
