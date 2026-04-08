"""Password hashing and JWT token utilities.

JWT is implemented with stdlib only (hmac + hashlib) to avoid conflicts with
the system cryptography package. Algorithm: HS256.
"""

import base64
import hashlib
import hmac
import json
import time
from passlib.context import CryptContext
from app.config import config

pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")

# ── JWT (HS256, stdlib only) ─────────────────────────────────────────────────

_HEADER = base64.urlsafe_b64encode(b'{"alg":"HS256","typ":"JWT"}').rstrip(b"=").decode()


def _b64enc(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64dec(s: str) -> bytes:
    pad = 4 - len(s) % 4
    return base64.urlsafe_b64decode(s + "=" * (pad % 4))


def _sign(msg: str) -> str:
    key = config.SECRET_KEY.encode()
    return _b64enc(hmac.new(key, msg.encode(), hashlib.sha256).digest())


def create_access_token(email: str, name: str, role: str) -> str:
    payload = {
        "sub": email,
        "name": name,
        "role": role,
        "exp": int(time.time()) + config.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }
    body = _b64enc(json.dumps(payload, separators=(",", ":")).encode())
    msg = f"{_HEADER}.{body}"
    return f"{msg}.{_sign(msg)}"


class TokenError(Exception):
    pass


def decode_token(token: str) -> dict:
    """Decode and validate a HS256 JWT. Raises TokenError on failure."""
    try:
        header, body, sig = token.split(".")
    except ValueError:
        raise TokenError("Malformed token")

    expected = _sign(f"{header}.{body}")
    if not hmac.compare_digest(expected, sig):
        raise TokenError("Invalid signature")

    payload = json.loads(_b64dec(body))
    if payload.get("exp", 0) < int(time.time()):
        raise TokenError("Token expired")
    return payload


# ── Password ─────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)
