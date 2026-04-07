"""Formatting Router v2 — instruction parsing + structure detection."""

import logging
from fastapi import APIRouter, HTTPException
from app.models.schemas import ParseInstructionRequest, FormatDocumentRequest
from app.services.ai_service import parse_formatting_instructions, detect_document_structure

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/parse-instruction")
async def parse_instruction(req: ParseInstructionRequest):
    try:
        rules, used_fallback = await parse_formatting_instructions(req.instruction)
        return {"status": "success", "rules": rules, "used_fallback": used_fallback}
    except Exception as e:
        logger.exception("Error in parse_instruction")
        raise HTTPException(500, detail="Failed to parse formatting instructions.")


@router.post("/format-document")
async def format_document(req: FormatDocumentRequest):
    try:
        structured = await detect_document_structure(req.document)
        return {"status": "success", "structured_document": structured, "rules": req.rules.model_dump()}
    except Exception as e:
        logger.exception("Error in format_document")
        raise HTTPException(500, detail="Failed to format document.")
