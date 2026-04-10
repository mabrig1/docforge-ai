"""Integration tests for FastAPI endpoints — Anthropic client and auth are mocked."""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient
from tests.conftest import apply_auth_override


def _make_mock_client(response_text: str):
    content_block = MagicMock()
    content_block.text = response_text
    message = MagicMock()
    message.content = [content_block]
    mock = MagicMock()
    mock.messages.create = AsyncMock(return_value=message)
    return mock


def _authed_app():
    """Return the FastAPI app with auth bypassed (no AI mock)."""
    from app.main import app
    apply_auth_override(app)
    return app


# ---------------------------------------------------------------------------
# /api/parse-instruction
# ---------------------------------------------------------------------------

def test_parse_instruction_returns_rules():
    rules = {"font": "Arial", "body_size": "12pt", "line_spacing": "2.0",
             "alignment": "justified", "referencing": "APA"}
    mock = _make_mock_client(json.dumps(rules))
    with patch("app.services.ai_service.client", mock):
        app = _authed_app()
        with TestClient(app) as c:
            resp = c.post("/api/parse-instruction", json={"instruction": "Arial 12pt APA"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert "rules" in data
    assert "used_fallback" in data


def test_parse_instruction_too_short():
    with TestClient(_authed_app()) as c:
        resp = c.post("/api/parse-instruction", json={"instruction": "hi"})
    assert resp.status_code == 422


def test_parse_instruction_too_long():
    with TestClient(_authed_app()) as c:
        resp = c.post("/api/parse-instruction", json={"instruction": "x" * 2001})
    assert resp.status_code == 422


def test_parse_instruction_fallback_on_bad_ai_response():
    mock = _make_mock_client("not valid json at all")
    with patch("app.services.ai_service.client", mock):
        app = _authed_app()
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
        app = _authed_app()
        with TestClient(app) as c:
            resp = c.post("/api/format-document", json={
                "document": "My Doc\nBody text.",
                "rules": {"font": "Arial", "body_size": "12pt", "line_spacing": "2.0",
                          "alignment": "justified", "referencing": "APA"},
            })
    assert resp.status_code == 200
    assert "[TITLE]" in resp.json()["structured_document"]


def test_format_document_too_long():
    with TestClient(_authed_app()) as c:
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
        app = _authed_app()
        with TestClient(app) as c:
            resp = c.post("/api/generate-citations", json={
                "document": "[PARAGRAPH] See Smith.\n[REF] Smith 2020",
                "style": "APA",
            })
    assert resp.status_code == 200
    assert resp.json()["style"] == "APA"


# ---------------------------------------------------------------------------
# /health  (public — no auth required)
# ---------------------------------------------------------------------------

def test_health():
    from app.main import app
    with TestClient(app) as c:
        resp = c.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "healthy"


# ---------------------------------------------------------------------------
# /api/auth  (public endpoints)
# ---------------------------------------------------------------------------

def test_auth_register_and_login():
    from app.main import app
    from app.database import Base, engine, SessionLocal
    from app.models.user import User
    Base.metadata.create_all(bind=engine)
    # Remove stale test user so this test is idempotent across runs
    with SessionLocal() as db:
        db.query(User).filter(User.email == "pytest_rl@test.com").delete()
        db.commit()
    with TestClient(app) as c:
        reg = c.post("/api/auth/register", json={
            "email": "pytest_rl@test.com",
            "name": "Pytest User",
            "password": "secure123",
        })
        assert reg.status_code == 200, reg.text
        assert "token" in reg.json()
        assert reg.json()["user"]["role"] == "user"

        login = c.post("/api/auth/login", json={
            "email": "pytest_rl@test.com",
            "password": "secure123",
        })
        assert login.status_code == 200
        assert "token" in login.json()


def test_auth_login_wrong_password():
    from app.main import app
    with TestClient(app) as c:
        resp = c.post("/api/auth/login", json={"email": "nobody@test.com", "password": "wrong"})
    assert resp.status_code == 401


def test_auth_register_duplicate_email():
    from app.main import app
    from app.database import Base, engine, SessionLocal
    from app.models.user import User
    Base.metadata.create_all(bind=engine)
    # Clean up before and after so this test is idempotent across runs
    with SessionLocal() as db:
        db.query(User).filter(User.email == "dup_pytest@test.com").delete()
        db.commit()
    try:
        with TestClient(app) as c:
            payload = {"email": "dup_pytest@test.com", "name": "Dup", "password": "secure123"}
            first = c.post("/api/auth/register", json=payload)
            assert first.status_code == 200, f"First registration failed: {first.text}"
            resp = c.post("/api/auth/register", json=payload)
        assert resp.status_code == 400
    finally:
        with SessionLocal() as db:
            db.query(User).filter(User.email == "dup_pytest@test.com").delete()
            db.commit()


def test_protected_route_requires_token():
    """Without auth, HTTPBearer returns 403 (missing credentials)."""
    from app.main import app
    saved = dict(app.dependency_overrides)
    app.dependency_overrides.clear()        # remove any override left by previous tests
    try:
        with TestClient(app) as c:
            resp = c.post("/api/format-document", json={
                "document": "x" * 20,
                "rules": {"font": "Arial", "body_size": "12pt", "line_spacing": "2.0",
                          "alignment": "justified", "referencing": "APA"},
            })
        assert resp.status_code in (401, 403)  # HTTPBearer returns 401/403 when missing
    finally:
        app.dependency_overrides.update(saved)
