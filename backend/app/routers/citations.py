"""Citations Router v2."""

import logging
from fastapi import APIRouter, Depends, HTTPException
from app.dependencies import track_usage
from app.models.schemas import GenerateCitationsRequest
from app.models.user import User
from app.services.ai_service import format_citations

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/generate-citations")
async def generate_citations(
    req: GenerateCitationsRequest,
    current_user: User = Depends(track_usage),
):
    try:
        formatted = await format_citations(req.document, req.style.value)
        return {"status": "success", "document": formatted, "style": req.style.value}
    except Exception:
        logger.exception("Error in generate_citations")
        raise HTTPException(500, detail="Failed to generate citations.")
