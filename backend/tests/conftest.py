"""Shared pytest configuration — sets ANTHROPIC_API_KEY so config doesn't error."""
import os
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key")
