"""Shared pytest configuration."""
import os
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only")

from dataclasses import dataclass
from datetime import datetime


@dataclass
class FakeUser:
    """Lightweight stand-in for the SQLAlchemy User model used in tests."""
    id: int = 1
    email: str = "test@test.com"
    name: str = "Test User"
    role: str = "user"
    is_active: bool = True
    usage_count: int = 0
    created_at: datetime = None

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.utcnow()


def apply_auth_override(app):
    """Override get_current_user so tests skip DB/JWT entirely."""
    from app.dependencies import get_current_user
    app.dependency_overrides[get_current_user] = FakeUser
    return app
