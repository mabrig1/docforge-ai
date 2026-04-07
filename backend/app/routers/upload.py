"""Upload Router — text extraction from .docx, .pdf, .txt, and .md files."""

import io
import logging
from fastapi import APIRouter, File, HTTPException, UploadFile

logger = logging.getLogger(__name__)
router = APIRouter()

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB


@router.post("/extract-text")
async def extract_text(file: UploadFile = File(...)):
    try:
        content = await file.read()
        if len(content) > MAX_UPLOAD_BYTES:
            raise HTTPException(400, detail="File too large (max 10 MB).")

        name = (file.filename or "").lower()

        if name.endswith(".docx"):
            text = _from_docx(content)
        elif name.endswith(".pdf"):
            text = _from_pdf(content)
        elif name.endswith((".txt", ".md")):
            text = content.decode("utf-8", errors="replace")
        else:
            raise HTTPException(
                400,
                detail="Unsupported file type. Please upload a .txt, .md, .docx, or .pdf file.",
            )

        return {"text": text, "filename": file.filename, "chars": len(text)}

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error extracting text from '%s'", file.filename)
        raise HTTPException(500, detail="Failed to extract text from the file.")


def _from_docx(data: bytes) -> str:
    from docx import Document

    doc = Document(io.BytesIO(data))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n\n".join(paragraphs)


def _from_pdf(data: bytes) -> str:
    try:
        import pypdf
    except ImportError:
        raise HTTPException(500, detail="PDF support is not available on this server.")

    reader = pypdf.PdfReader(io.BytesIO(data))
    pages = [reader.pages[i].extract_text() or "" for i in range(len(reader.pages))]
    return "\n\n".join(page.strip() for page in pages if page.strip())
