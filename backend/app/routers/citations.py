"""Citations Router v2."""

from fastapi import APIRouter, HTTPException
from app.models.schemas import GenerateCitationsRequest
from app.services.ai_service import format_citations

router = APIRouter()


@router.post("/generate-citations")
async def generate_citations(req: GenerateCitationsRequest):
    try:
        formatted = await format_citations(req.document, req.style.value)
        return {"status": "success", "document": formatted, "style": req.style.value}
    except Exception as e:
        raise HTTPException(500, detail=str(e))
