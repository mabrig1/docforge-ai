"""Configuration — environment variables."""
import os
import secrets
from dataclasses import dataclass, field


@dataclass
class Config:
    # Anthropic
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    ANTHROPIC_MODEL: str = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")
    # Server
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    CORS_ORIGINS: list = field(default_factory=lambda: [
        o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
    ])
    # Auth — set SECRET_KEY in production .env
    SECRET_KEY: str = os.getenv("SECRET_KEY", secrets.token_hex(32))
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))  # 24 h
    # Admin seed account — change these in .env before first run
    ADMIN_EMAIL: str = os.getenv("ADMIN_EMAIL", "admin@docforge.ai")
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "Admin@DocForge2024")
    ADMIN_NAME: str = os.getenv("ADMIN_NAME", "Administrator")


config = Config()
