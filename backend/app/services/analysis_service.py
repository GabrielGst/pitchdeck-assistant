"""
AnalysisService — tertiary testing seam.

Orchestrates three sequential LLM calls:
  1. Scorecard (non-streaming, structured JSON)
  2. DD questions (non-streaming, structured JSON)
  3. Investment memo (streaming, free-form prose)

All calls go through LiteLLM so the model is swappable via LLM_MODEL env var.
Every call is traced in Langfuse tagged with tenant_id and deal_id.
"""

from __future__ import annotations

import json
import re
from collections.abc import Iterator
from dataclasses import dataclass, field
from typing import Any

import litellm
from langfuse import Langfuse

from app.core.config import settings
from app.models.analysis import UNIVERSAL_DIMENSIONS, RiskLevel

langfuse = Langfuse(
    public_key=settings.langfuse_public_key or "dummy",
    secret_key=settings.langfuse_secret_key or "dummy",
    host=settings.langfuse_host,
    enabled=bool(settings.langfuse_public_key),
)

# ---------------------------------------------------------------------------
# Data transfer objects
# ---------------------------------------------------------------------------

@dataclass
class ScoreDimension:
    key: str
    score: int
    rationale: str
    is_custom: bool = False


@dataclass
class DDItem:
    question: str
    risk_level: RiskLevel
    position: int


@dataclass
class AnalysisOutput:
    scorecard: list[ScoreDimension] = field(default_factory=list)
    dd_questions: list[DDItem] = field(default_factory=list)
    memo_text: str = ""

# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

_SCORECARD_SYSTEM = """You are a senior venture capital investment analyst. \
Evaluate pitch decks rigorously and objectively. \
Return ONLY valid JSON — no markdown fences, no preamble."""

_SCORECARD_USER = """\
Analyse this pitch deck and return a scorecard.

Return ONLY a JSON object with this exact structure (scores 1–5, where 5 is exceptional):
{{
  "dimensions": [
    {{"key": "team", "score": <int>, "rationale": "<one sentence>"}},
    {{"key": "market_size", "score": <int>, "rationale": "<one sentence>"}},
    {{"key": "traction", "score": <int>, "rationale": "<one sentence>"}},
    {{"key": "business_model", "score": <int>, "rationale": "<one sentence>"}},
    {{"key": "competition", "score": <int>, "rationale": "<one sentence>"}},
    {{"key": "financials", "score": <int>, "rationale": "<one sentence>"}},
    {{"key": "overall", "score": <int>, "rationale": "<one sentence>"}}
    {custom_dims}
  ]
}}

{thesis_context}

DECK CONTENT:
{deck_text}"""

_DD_SYSTEM = """You are a meticulous VC due diligence analyst. \
Identify the most important open questions and risks from this pitch deck. \
Return ONLY valid JSON — no markdown, no explanation."""

_DD_USER = """\
Review this pitch deck and return the 5–8 most important due diligence questions.

Return ONLY a JSON array:
[
  {{"question": "<specific, actionable question>", "risk_level": "high|medium|low"}},
  ...
]

{thesis_context}

DECK CONTENT:
{deck_text}"""

_MEMO_SYSTEM = """You are a senior VC investment analyst writing an investment memo. \
Be analytical, precise, and structured. Write in professional investment memo style."""

_MEMO_USER = """\
Write a comprehensive investment memo for this pitch deck.

Structure your memo with these sections:
## Executive Summary
## Company Overview
## Market Opportunity
## Product & Technology
## Team
## Traction & Financials
## Competitive Landscape
## Investment Thesis
## Key Risks & Mitigants
## Due Diligence Priorities

{thesis_context}

DECK CONTENT:
{deck_text}"""

# ---------------------------------------------------------------------------
# Core service
# ---------------------------------------------------------------------------

def generate(
    deck_text: str,
    deal_id: str,
    tenant_id: str,
    thesis_context: str = "",
    custom_dims: list[dict] = [],
) -> Iterator[tuple[str, Any]]:
    """
    Generator that yields (event_type, payload) tuples as analysis is produced.
    Consumed by the SSE endpoint which formats them into SSE frames.

    Events:
      ("progress", {"stage": "scorecard"|"dd_questions"|"memo"})
      ("scorecard", list[dict])
      ("dd_questions", list[dict])
      ("memo_chunk", {"text": str})
      ("complete", {"memo_text": str})
      ("error", {"message": str})
    """
    trace = langfuse.trace(
        name="analyze_deck",
        metadata={"deal_id": deal_id, "tenant_id": tenant_id, "model": settings.llm_model},
    )

    ctx = f"\nINVESTMENT CRITERIA CONTEXT:\n{thesis_context}" if thesis_context else ""
    custom_dim_json = ""
    if custom_dims:
        extra = [f',\n    {{"key": "{d["key"]}", "score": <int>, "rationale": "<one sentence>"}}' for d in custom_dims]
        custom_dim_json = "".join(extra)

    # ── Phase 1: Scorecard ──────────────────────────────────────────────────
    yield ("progress", {"stage": "scorecard"})
    scorecard_prompt = _SCORECARD_USER.format(
        deck_text=deck_text[:60_000],
        thesis_context=ctx,
        custom_dims=custom_dim_json,
    )
    gen1 = trace.generation(name="scorecard", model=settings.llm_model, input=scorecard_prompt)
    try:
        sc_resp = litellm.completion(
            model=settings.llm_model,
            messages=[
                {"role": "system", "content": _SCORECARD_SYSTEM},
                {"role": "user", "content": scorecard_prompt},
            ],
            temperature=0.2,
            max_tokens=1500,
        )
        sc_text = sc_resp.choices[0].message.content or ""
        gen1.end(output=sc_text)
        scorecard_data = _parse_scorecard(sc_text, custom_dims)
        yield ("scorecard", scorecard_data)
    except Exception as e:
        gen1.end(level="ERROR", status_message=str(e))
        yield ("error", {"message": f"Scorecard generation failed: {e}"})
        return

    # ── Phase 2: DD Questions ───────────────────────────────────────────────
    yield ("progress", {"stage": "dd_questions"})
    dd_prompt = _DD_USER.format(deck_text=deck_text[:60_000], thesis_context=ctx)
    gen2 = trace.generation(name="dd_questions", model=settings.llm_model, input=dd_prompt)
    try:
        dd_resp = litellm.completion(
            model=settings.llm_model,
            messages=[
                {"role": "system", "content": _DD_SYSTEM},
                {"role": "user", "content": dd_prompt},
            ],
            temperature=0.3,
            max_tokens=1000,
        )
        dd_text = dd_resp.choices[0].message.content or ""
        gen2.end(output=dd_text)
        dd_data = _parse_dd_questions(dd_text)
        yield ("dd_questions", dd_data)
    except Exception as e:
        gen2.end(level="ERROR", status_message=str(e))
        yield ("error", {"message": f"DD question generation failed: {e}"})
        return

    # ── Phase 3: Memo (streaming) ───────────────────────────────────────────
    yield ("progress", {"stage": "memo"})
    memo_prompt = _MEMO_USER.format(deck_text=deck_text[:60_000], thesis_context=ctx)
    gen3 = trace.generation(name="memo", model=settings.llm_model, input=memo_prompt)
    memo_chunks: list[str] = []
    try:
        stream = litellm.completion(
            model=settings.llm_model,
            messages=[
                {"role": "system", "content": _MEMO_SYSTEM},
                {"role": "user", "content": memo_prompt},
            ],
            temperature=0.4,
            max_tokens=3000,
            stream=True,
        )
        for chunk in stream:
            delta = chunk.choices[0].delta.content or ""
            if delta:
                memo_chunks.append(delta)
                yield ("memo_chunk", {"text": delta})

        full_memo = "".join(memo_chunks)
        gen3.end(output=full_memo)
        yield ("complete", {"memo_text": full_memo, "scorecard": scorecard_data, "dd_questions": dd_data})
    except Exception as e:
        gen3.end(level="ERROR", status_message=str(e))
        yield ("error", {"message": f"Memo generation failed: {e}"})


# ---------------------------------------------------------------------------
# JSON parsers — handle LLM output that may have markdown fences
# ---------------------------------------------------------------------------

def _strip_fences(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _parse_scorecard(text: str, custom_dims: list[dict]) -> list[dict]:
    try:
        data = json.loads(_strip_fences(text))
        dims = data.get("dimensions", [])
        custom_keys = {d["key"] for d in custom_dims}
        return [
            {
                "key": d["key"],
                "score": max(1, min(5, int(d.get("score", 3)))),
                "rationale": d.get("rationale", ""),
                "is_custom": d["key"] in custom_keys,
            }
            for d in dims
            if d.get("key") in set(UNIVERSAL_DIMENSIONS) | custom_keys
        ]
    except Exception:
        # Return a default scorecard rather than failing the whole analysis
        return [{"key": k, "score": 3, "rationale": "Could not parse LLM output", "is_custom": False} for k in UNIVERSAL_DIMENSIONS]


def _parse_dd_questions(text: str) -> list[dict]:
    try:
        items = json.loads(_strip_fences(text))
        if not isinstance(items, list):
            items = items.get("questions", [])
        valid_risks = {"high", "medium", "low"}
        return [
            {
                "question": str(item.get("question", "")),
                "risk_level": item.get("risk_level", "medium") if item.get("risk_level") in valid_risks else "medium",
                "position": i,
            }
            for i, item in enumerate(items)
            if item.get("question")
        ]
    except Exception:
        return []
