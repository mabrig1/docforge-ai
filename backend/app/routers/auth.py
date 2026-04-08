"""Auth Router — register, login, profile, admin user management."""

import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models.user import User
from app.services.auth_service import create_access_token, hash_password, verify_password

logger = logging.getLogger(__name__)
router = APIRouter()


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
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "is_active": user.is_active,
        "usage_count": user.usage_count,
        "created_at": user.created_at.isoformat(),
    }


# ── Public endpoints ─────────────────────────────────────────────────────────

@router.post("/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
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
def login(req: LoginRequest, db: Session = Depends(get_db)):
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
