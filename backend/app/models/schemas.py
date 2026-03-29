"""Data models v2 — request/response schemas with expanded heading support."""

from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class ReferenceStyle(str, Enum):
    APA = "APA"
    MLA = "MLA"
    CHICAGO = "Chicago"
    HARVARD = "Harvard"
    IEEE = "IEEE"
    NONE = "none"


class HeadingStyle(BaseModel):
    size: str = "16pt"
    bold: bool = True
    italic: bool = False
    color: Optional[str] = "#000000"
    alignment: Optional[str] = "left"
    caps: Optional[bool] = False


class FormattingRules(BaseModel):
    font: str = "Times New Roman"
    body_size: str = "12pt"
    line_spacing: str = "1.5"
    paragraph_spacing_after: str = "8pt"
    heading_1: HeadingStyle = HeadingStyle(size="14pt", bold=True, color="#000000")
    heading_2: HeadingStyle = HeadingStyle(size="12pt", bold=True, italic=True)
    heading_3: HeadingStyle = HeadingStyle(size="12pt", italic=True)
    alignment: str = "justified"
    referencing: str = "APA"
    margins: Optional[str] = "1 inch"
    first_line_indent: Optional[str] = "0.5 inch"


class ParseInstructionRequest(BaseModel):
    instruction: str = Field(..., min_length=3)


class FormatDocumentRequest(BaseModel):
    document: str = Field(..., min_length=10)
    rules: FormattingRules


class GenerateCitationsRequest(BaseModel):
    document: str = Field(..., min_length=10)
    style: ReferenceStyle = ReferenceStyle.APA


class ExportRequest(BaseModel):
    document: str = Field(..., min_length=10)
    rules: FormattingRules
    format: str = Field(default="docx", pattern="^(docx|pdf)$")
