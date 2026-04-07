"""Integration tests for FastAPI endpoints — Anthropic client is mocked."""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient


def _make_mock_client(response_text: str):
    content_block = MagicMock()
    content_block.text = response_text
    message = MagicMock()
    message.content = [content_block]
    mock = MagicMock()
    mock.messages.create = AsyncMock(return_value=message)
    return mock


@pytest.fixture
def client():
    with patch("app.services.ai_service.client", _make_mock_client("{}")):
        from app.main import app
        with TestClient(app) as c:
            yield c


# ---------------------------------------------------------------------------
# /api/parse-instruction
# ---------------------------------------------------------------------------

def test_parse_instruction_returns_rules():
    rules = {"font": "Arial", "body_size": "12pt", "line_spacing": "2.0",
             "alignment": "justified", "referencing": "APA"}
    mock = _make_mock_client(json.dumps(rules))
    with patch("app.services.ai_service.client", mock):
        from app.main import app
        with TestClient(app) as c:
            resp = c.post("/api/parse-instruction", json={"instruction": "Arial 12pt APA"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert "rules" in data
    assert "used_fallback" in data


def test_parse_instruction_too_short():
    from app.main import app
    with TestClient(app) as c:
        resp = c.post("/api/parse-instruction", json={"instruction": "hi"})
    assert resp.status_code == 422


def test_parse_instruction_too_long():
    from app.main import app
    with TestClient(app) as c:
        resp = c.post("/api/parse-instruction", json={"instruction": "x" * 2001})
    assert resp.status_code == 422


def test_parse_instruction_fallback_on_bad_ai_response():
    mock = _make_mock_client("not valid json at all")
    with patch("app.services.ai_service.client", mock):
        from app.main import app
        with TestClient(app) as c:
            resp = c.post("/api/parse-instruction", json={"instruction": "some instruction"})
    assert resp.status_code == 200
    assert resp.json()["used_fallback"] is True


# ---------------------------------------------------------------------------
# /api/format-document
# ---------------------------------------------------------------------------

def test_format_document_returns_structured():
    mock = _make_mock_client("[TITLE] My Doc\n[PARAGRAPH] Body text.")
    with patch("app.services.ai_service.client", mock):
        from app.main import app
        with TestClient(app) as c:
            resp = c.post("/api/format-document", json={
                "document": "My Doc\nBody text.",
                "rules": {"font": "Arial", "body_size": "12pt", "line_spacing": "2.0",
                          "alignment": "justified", "referencing": "APA"},
            })
    assert resp.status_code == 200
    assert "[TITLE]" in resp.json()["structured_document"]


def test_format_document_too_long():
    from app.main import app
    with TestClient(app) as c:
        resp = c.post("/api/format-document", json={
            "document": "x" * 100_001,
            "rules": {"font": "Arial", "body_size": "12pt", "line_spacing": "2.0",
                      "alignment": "justified", "referencing": "APA"},
        })
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# /api/generate-citations
# ---------------------------------------------------------------------------

def test_generate_citations_success():
    mock = _make_mock_client("[PARAGRAPH] See (Smith, 2020).\n[REF] Smith, J. (2020). Book. Publisher.")
    with patch("app.services.ai_service.client", mock):
        from app.main import app
        with TestClient(app) as c:
            resp = c.post("/api/generate-citations", json={
                "document": "[PARAGRAPH] See Smith.\n[REF] Smith 2020",
                "style": "APA",
            })
    assert resp.status_code == 200
    assert resp.json()["style"] == "APA"


# ---------------------------------------------------------------------------
# /health
# ---------------------------------------------------------------------------

def test_health():
    from app.main import app
    with TestClient(app) as c:
        resp = c.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "healthy"
