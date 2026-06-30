"""
Tests for AnalysisService — tertiary testing seam.
LLM calls are mocked; tests assert output structure and graceful degradation.
"""

from unittest.mock import MagicMock, patch

from app.models.analysis import UNIVERSAL_DIMENSIONS
from app.services.analysis_service import _parse_dd_questions, _parse_scorecard, _strip_fences


def test_strip_fences_removes_markdown():
    assert _strip_fences("```json\n{}\n```") == "{}"
    assert _strip_fences("```\n[]\n```") == "[]"
    assert _strip_fences('{"key": "value"}') == '{"key": "value"}'


def test_parse_scorecard_valid_json():
    raw = """{"dimensions": [
        {"key": "team", "score": 4, "rationale": "Strong founders"},
        {"key": "market_size", "score": 5, "rationale": "Huge TAM"},
        {"key": "traction", "score": 3, "rationale": "Early stage"},
        {"key": "business_model", "score": 4, "rationale": "SaaS recurring"},
        {"key": "competition", "score": 3, "rationale": "Crowded space"},
        {"key": "financials", "score": 2, "rationale": "Pre-revenue"},
        {"key": "overall", "score": 4, "rationale": "Strong team"}
    ]}"""
    result = _parse_scorecard(raw, [])
    assert len(result) == 7
    assert result[0]["key"] == "team"
    assert result[0]["score"] == 4
    assert result[0]["is_custom"] is False


def test_parse_scorecard_clamps_scores():
    raw = """{"dimensions": [{"key": "team", "score": 99, "rationale": "x"},
        {"key": "market_size", "score": 0, "rationale": "x"},
        {"key": "traction", "score": 3, "rationale": "x"},
        {"key": "business_model", "score": 3, "rationale": "x"},
        {"key": "competition", "score": 3, "rationale": "x"},
        {"key": "financials", "score": 3, "rationale": "x"},
        {"key": "overall", "score": 3, "rationale": "x"}
    ]}"""
    result = _parse_scorecard(raw, [])
    scores = {d["key"]: d["score"] for d in result}
    assert scores["team"] == 5
    assert scores["market_size"] == 1


def test_parse_scorecard_returns_defaults_on_bad_json():
    result = _parse_scorecard("not json at all {{", [])
    keys = {d["key"] for d in result}
    assert keys == set(UNIVERSAL_DIMENSIONS)
    assert all(d["score"] == 3 for d in result)


def test_parse_scorecard_includes_custom_dims():
    raw = """{"dimensions": [
        {"key": "team", "score": 4, "rationale": "x"},
        {"key": "market_size", "score": 4, "rationale": "x"},
        {"key": "traction", "score": 4, "rationale": "x"},
        {"key": "business_model", "score": 4, "rationale": "x"},
        {"key": "competition", "score": 4, "rationale": "x"},
        {"key": "financials", "score": 4, "rationale": "x"},
        {"key": "overall", "score": 4, "rationale": "x"},
        {"key": "founder_market_fit", "score": 5, "rationale": "Perfect fit"}
    ]}"""
    custom = [{"key": "founder_market_fit", "label": "Founder-Market Fit"}]
    result = _parse_scorecard(raw, custom)
    custom_dim = next((d for d in result if d["key"] == "founder_market_fit"), None)
    assert custom_dim is not None
    assert custom_dim["is_custom"] is True
    assert custom_dim["score"] == 5


def test_parse_dd_questions_valid():
    raw = '[{"question": "What is your CAC?", "risk_level": "high"}, {"question": "Who are your top 3 competitors?", "risk_level": "medium"}]'
    result = _parse_dd_questions(raw)
    assert len(result) == 2
    assert result[0]["question"] == "What is your CAC?"
    assert result[0]["risk_level"] == "high"
    assert result[0]["position"] == 0


def test_parse_dd_questions_invalid_risk_defaults_to_medium():
    raw = '[{"question": "Q1", "risk_level": "extreme"}]'
    result = _parse_dd_questions(raw)
    assert result[0]["risk_level"] == "medium"


def test_parse_dd_questions_returns_empty_on_bad_json():
    result = _parse_dd_questions("not json")
    assert result == []


def test_generate_yields_all_event_types():
    """Mock LiteLLM and assert the generator yields the expected event sequence."""
    mock_sc_response = MagicMock()
    mock_sc_response.choices[0].message.content = '{"dimensions": [' + ",".join(
        f'{{"key": "{k}", "score": 4, "rationale": "x"}}' for k in UNIVERSAL_DIMENSIONS
    ) + ']}'

    mock_dd_response = MagicMock()
    mock_dd_response.choices[0].message.content = '[{"question": "Test Q?", "risk_level": "high"}]'

    # Streaming mock: yields chunks
    chunk1, chunk2 = MagicMock(), MagicMock()
    chunk1.choices[0].delta.content = "Investment memo "
    chunk2.choices[0].delta.content = "content here."

    call_count = 0

    def mock_completion(**kwargs):
        nonlocal call_count
        call_count += 1
        if kwargs.get("stream"):
            return iter([chunk1, chunk2])
        return mock_sc_response if call_count == 1 else mock_dd_response

    with patch("app.services.analysis_service.litellm.completion", side_effect=mock_completion):
        from app.services.analysis_service import generate
        events = list(generate("Sample deck text", "deal-123", "tenant-456"))

    event_types = [e[0] for e in events]
    assert "progress" in event_types
    assert "scorecard" in event_types
    assert "dd_questions" in event_types
    assert "memo_chunk" in event_types
    assert "complete" in event_types
    assert "error" not in event_types
