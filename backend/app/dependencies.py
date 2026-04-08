"""FastAPI dependencies — authentication, authorisation, and quota enforcement."""

import logging
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.services.auth_service import decode_token, TokenError

logger = logging.getLogger(__name__)
bearer = HTTPBearer()

# Credits per plan — admin role always bypasses this table
PLAN_QUOTAS: dict[str, int] = {
    "free": 0,
    "assignment": 5,    # ₦1,000 / 5 jobs
    "term_paper": 3,    # ₦1,000 / 3 jobs
    "project": 15,      # ₦1,500 / full project (generous limit)
}


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


def track_usage(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    """Check quota then increment usage_count. Admin role = unlimited."""
    if current_user.role == "admin":
        return current_user

    limit = PLAN_QUOTAS.get(current_user.plan or "free", 0)
    if current_user.usage_count >= limit:
        plan_label = (current_user.plan or "free").replace("_", " ").title()
        raise HTTPException(
            402,
            detail=(
                f"You have used all {limit} job(s) on your {plan_label} plan. "
                "Please contact the admin to top up your credits."
            ),
        )

    # Atomic increment so concurrent requests don't race
    db.query(User).filter(User.id == current_user.id).update(
        {"usage_count": User.usage_count + 1}
    )
    db.commit()
    db.refresh(current_user)
    logger.info("Usage tracked: user=%s plan=%s count=%d/%d",
                current_user.email, current_user.plan, current_user.usage_count, limit)
    return current_user
