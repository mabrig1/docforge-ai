"""Tests for ai_service — uses mocked AsyncAnthropic client."""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


@pytest.fixture
def mock_client():
    """Patch the AsyncAnthropic client used inside ai_service."""
    content_block = MagicMock()
    content_block.text = ""  # overridden per test
    message = MagicMock()
    message.content = [content_block]

    async_create = AsyncMock(return_value=message)
    mock = MagicMock()
    mock.messages.create = async_create

    with patch("app.services.ai_service.client", mock):
        yield mock, content_block


# ---------------------------------------------------------------------------
# parse_formatting_instructions
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_parse_formatting_instructions_valid_json(mock_client):
    mock, cb = mock_client
    rules = {"font": "Arial", "body_size": "11pt", "line_spacing": "1.5", "alignment": "left", "referencing": "MLA"}
    cb.text = json.dumps(rules)

    from app.services.ai_service import parse_formatting_instructions
    result, used_fallback = await parse_formatting_instructions("Arial 11pt MLA style")

    assert used_fallback is False
    assert result["font"] == "Arial"
    assert result["referencing"] == "MLA"


@pytest.mark.asyncio
async def test_parse_formatting_instructions_json_in_fence(mock_client):
    mock, cb = mock_client
    rules = {"font": "Calibri", "body_size": "12pt", "line_spacing": "2.0", "alignment": "justified", "referencing": "APA"}
    cb.text = f"```json\n{json.dumps(rules)}\n```"

    from app.services.ai_service import parse_formatting_instructions
    result, used_fallback = await parse_formatting_instructions("Calibri double-spaced APA")

    assert used_fallback is False
    assert result["font"] == "Calibri"


@pytest.mark.asyncio
async def test_parse_formatting_instructions_fallback_on_bad_json(mock_client):
    mock, cb = mock_client
    cb.text = "Sorry, I cannot help with that."

    from app.services.ai_service import parse_formatting_instructions
    result, used_fallback = await parse_formatting_instructions("make it nice")

    assert used_fallback is True
    assert result["font"] == "Times New Roman"  # fallback default


# ---------------------------------------------------------------------------
# detect_document_structure
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_detect_document_structure_returns_tagged_text(mock_client):
    mock, cb = mock_client
    cb.text = "[TITLE] My Paper\n[H1] Introduction\n[PARAGRAPH] This is a paragraph."

    from app.services.ai_service import detect_document_structure
    result = await detect_document_structure("My Paper\nIntroduction\nThis is a paragraph.")

    assert "[TITLE]" in result
    assert "[H1]" in result
    assert "[PARAGRAPH]" in result


# ---------------------------------------------------------------------------
# format_citations
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_format_citations_preserves_tags(mock_client):
    mock, cb = mock_client
    cb.text = "[H1] Introduction\n[PARAGRAPH] See (Smith, 2020).\n[REF] Smith, J. (2020). A Book. Publisher."

    from app.services.ai_service import format_citations
    result = await format_citations("[H1] Introduction\n[PARAGRAPH] See Smith.\n[REF] Smith.", "APA")

    assert "[H1]" in result
    assert "[REF]" in result
