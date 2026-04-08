"""DocForge AI — FastAPI Backend v2."""

import logging
from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI, Request
from sqlalchemy import inspect, text
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from app.config import config
from app.database import Base, SessionLocal, engine
from app.dependencies import get_current_user
from app.models.user import User
from app.routers import citations, export, formatting, upload
from app.routers import auth as auth_router
from app.services.auth_service import hash_password

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)


def _seed_admin() -> None:
    """Create the admin account on first run if it doesn't exist."""
    db = SessionLocal()
    try:
        if not db.query(User).filter(User.email == config.ADMIN_EMAIL.lower()).first():
            admin = User(
                email=config.ADMIN_EMAIL.lower(),
                name=config.ADMIN_NAME,
                password_hash=hash_password(config.ADMIN_PASSWORD),
                role="admin",
            )
            db.add(admin)
            db.commit()
            logger.info("Admin account created → %s", config.ADMIN_EMAIL)
        else:
            logger.info("Admin account already exists → %s", config.ADMIN_EMAIL)
    finally:
        db.close()


def _migrate() -> None:
    """Add new columns to existing tables without alembic."""
    insp = inspect(engine)
    existing = {c["name"] for c in insp.get_columns("users")}
    with engine.connect() as conn:
        if "plan" not in existing:
            conn.execute(text("ALTER TABLE users ADD COLUMN plan TEXT DEFAULT 'free'"))
            conn.commit()
            logger.info("Migration: added 'plan' column to users table")


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _migrate()
    _seed_admin()
    yield


# ── Rate limiter (IP-based, applies to all routes) ───────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])

app = FastAPI(title="DocForge AI", version="2.0.0", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.exception_handler(Exception)
async def global_error_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url)
    return JSONResponse(status_code=500, content={"detail": "An internal error occurred. Please try again."})


# ── Auth router (public — no token required) ─────────────────────────────────
app.include_router(auth_router.router, prefix="/api/auth", tags=["Auth"])

# ── Protected routers (JWT required) ─────────────────────────────────────────
_auth = [Depends(get_current_user)]
app.include_router(formatting.router, prefix="/api", tags=["Formatting"], dependencies=_auth)
app.include_router(export.router,     prefix="/api", tags=["Export"],      dependencies=_auth)
app.include_router(citations.router,  prefix="/api", tags=["Citations"],   dependencies=_auth)
app.include_router(upload.router,     prefix="/api", tags=["Upload"],      dependencies=_auth)


@app.get("/")
async def root():
    return {"status": "ok", "service": "DocForge AI", "version": "2.0.0"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
