"""DocForge AI — FastAPI Backend v2."""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.routers import formatting, export, citations

app = FastAPI(title="DocForge AI", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_error_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": str(exc)})


app.include_router(formatting.router, prefix="/api", tags=["Formatting"])
app.include_router(export.router, prefix="/api", tags=["Export"])
app.include_router(citations.router, prefix="/api", tags=["Citations"])


@app.get("/")
async def root():
    return {"status": "ok", "service": "DocForge AI", "version": "2.0.0"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
