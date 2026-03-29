"""Export Router v2 — .docx and .pdf generation."""

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from app.models.schemas import ExportRequest
from app.services.export_service import create_docx, create_pdf

router = APIRouter()

MIME = {
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "pdf": "application/pdf",
}


@router.post("/export")
async def export_document(req: ExportRequest):
    try:
        rules = req.rules.model_dump()
        if req.format == "pdf":
            content = create_pdf(req.document, rules)
        else:
            content = create_docx(req.document, rules)
        return Response(
            content=content,
            media_type=MIME.get(req.format, MIME["docx"]),
            headers={"Content-Disposition": f"attachment; filename=formatted.{req.format}"},
        )
    except Exception as e:
        raise HTTPException(500, detail=str(e))
