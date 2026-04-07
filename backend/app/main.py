"""DocForge AI — FastAPI Backend v2."""

import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.config import config
from app.routers import formatting, export, citations

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])

app = FastAPI(title="DocForge AI", version="2.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_error_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url)
    return JSONResponse(status_code=500, content={"detail": "An internal error occurred. Please try again."})


app.include_router(formatting.router, prefix="/api", tags=["Formatting"])
app.include_router(export.router, prefix="/api", tags=["Export"])
app.include_router(citations.router, prefix="/api", tags=["Citations"])


@app.get("/")
async def root():
    return {"status": "ok", "service": "DocForge AI", "version": "2.0.0"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
