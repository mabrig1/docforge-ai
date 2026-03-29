"""Formatting Router v2 — instruction parsing + structure detection."""

from fastapi import APIRouter, HTTPException
from app.models.schemas import ParseInstructionRequest, FormatDocumentRequest
from app.services.ai_service import parse_formatting_instructions, detect_document_structure

router = APIRouter()


@router.post("/parse-instruction")
async def parse_instruction(req: ParseInstructionRequest):
    try:
        rules = await parse_formatting_instructions(req.instruction)
        return {"status": "success", "rules": rules}
    except Exception as e:
        raise HTTPException(500, detail=str(e))


@router.post("/format-document")
async def format_document(req: FormatDocumentRequest):
    try:
        structured = await detect_document_structure(req.document)
        return {"status": "success", "structured_document": structured, "rules": req.rules.model_dump()}
    except Exception as e:
        raise HTTPException(500, detail=str(e))
