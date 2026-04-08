"""Auth Router — register, login, profile, admin user management."""

import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user, require_admin, PLAN_QUOTAS
from app.models.user import User
from app.services.auth_service import create_access_token, hash_password, verify_password

VALID_PLANS = set(PLAN_QUOTAS.keys())

logger = logging.getLogger(__name__)
router = APIRouter()
_limiter = Limiter(key_func=get_remote_address)


# ── Request schemas ──────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=254)
    name: str = Field(..., min_length=2, max_length=80)
    password: str = Field(..., min_length=6, max_length=128)


class LoginRequest(BaseModel):
    email: str
    password: str


# ── Helpers ──────────────────────────────────────────────────────────────────

def _user_dict(user: User) -> dict:
    plan = user.plan or "free"
    limit = PLAN_QUOTAS.get(plan, 0) if user.role != "admin" else None
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "plan": plan,
        "is_active": user.is_active,
        "usage_count": user.usage_count,
        "usage_limit": limit,          # None = unlimited (admin)
        "credits_remaining": None if limit is None else max(0, limit - user.usage_count),
        "created_at": user.created_at.isoformat(),
    }


# ── Public endpoints ─────────────────────────────────────────────────────────

@router.post("/register")
@_limiter.limit("10/minute")
def register(request: Request, req: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == req.email.lower()).first():
        raise HTTPException(400, detail="An account with this email already exists.")
    user = User(
        email=req.email.lower(),
        name=req.name.strip(),
        password_hash=hash_password(req.password),
        role="user",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info("New user registered: %s", user.email)
    token = create_access_token(user.email, user.name, user.role)
    return {"token": token, "user": _user_dict(user)}


@router.post("/login")
@_limiter.limit("5/minute")
def login(request: Request, req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email.lower()).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(401, detail="Invalid email or password.")
    if not user.is_active:
        raise HTTPException(403, detail="This account has been disabled.")
    token = create_access_token(user.email, user.name, user.role)
    return {"token": token, "user": _user_dict(user)}


# ── Authenticated endpoints ───────────────────────────────────────────────────

@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return _user_dict(current_user)


# ── Admin-only endpoints ──────────────────────────────────────────────────────

@router.get("/users")
def list_users(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [_user_dict(u) for u in users]


@router.patch("/users/{user_id}/toggle")
def toggle_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, detail="User not found.")
    if user.role == "admin":
        raise HTTPException(400, detail="Cannot disable an admin account.")
    if user.id == admin.id:
        raise HTTPException(400, detail="Cannot disable your own account.")
    user.is_active = not user.is_active
    db.commit()
    logger.info("Admin toggled user %s → active=%s", user.email, user.is_active)
    return _user_dict(user)


class SetPlanRequest(BaseModel):
    plan: str = Field(..., pattern="^(free|assignment|term_paper|project)$")


@router.patch("/users/{user_id}/plan")
def set_plan(
    user_id: int,
    req: SetPlanRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Assign a plan and reset usage counter (admin only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, detail="User not found.")
    user.plan = req.plan
    user.usage_count = 0      # fresh credits on new plan
    db.commit()
    logger.info("Admin set plan for %s → %s (usage reset)", user.email, req.plan)
    return _user_dict(user)
