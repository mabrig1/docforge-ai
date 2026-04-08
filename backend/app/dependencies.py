"""FastAPI dependencies — authentication and authorisation."""

import logging
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.services.auth_service import decode_token, TokenError

logger = logging.getLogger(__name__)
bearer = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    try:
        payload = decode_token(credentials.credentials)
        email: str = payload.get("sub")
        if not email:
            raise HTTPException(401, detail="Invalid token.")
    except TokenError:
        raise HTTPException(401, detail="Invalid or expired token.")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(401, detail="User account not found.")
    if not user.is_active:
        raise HTTPException(403, detail="Account has been disabled.")
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(403, detail="Admin access required.")
    return current_user
