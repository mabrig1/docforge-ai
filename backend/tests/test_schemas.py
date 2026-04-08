"""Tests for Pydantic schemas — validation boundaries."""

import pytest
from pydantic import ValidationError
from app.models.schemas import (
    ParseInstructionRequest,
    FormatDocumentRequest,
    GenerateCitationsRequest,
    ExportRequest,
    FormattingRules,
    ReferenceStyle,
    MAX_DOCUMENT_CHARS,
    MAX_INSTRUCTION_CHARS,
)

DEFAULT_RULES = FormattingRules()


class TestParseInstructionRequest:
    def test_valid(self):
        req = ParseInstructionRequest(instruction="Times New Roman 12pt APA")
        assert req.instruction == "Times New Roman 12pt APA"

    def test_too_short(self):
        with pytest.raises(ValidationError):
            ParseInstructionRequest(instruction="hi")

    def test_too_long(self):
        with pytest.raises(ValidationError):
            ParseInstructionRequest(instruction="x" * (MAX_INSTRUCTION_CHARS + 1))

    def test_max_length_boundary(self):
        ParseInstructionRequest(instruction="x" * MAX_INSTRUCTION_CHARS)


class TestFormatDocumentRequest:
    def test_valid(self):
        req = FormatDocumentRequest(document="Hello world document text.", rules=DEFAULT_RULES)
        assert req.document.startswith("Hello")

    def test_too_short(self):
        with pytest.raises(ValidationError):
            FormatDocumentRequest(document="short", rules=DEFAULT_RULES)

    def test_too_long(self):
        with pytest.raises(ValidationError):
            FormatDocumentRequest(document="x" * (MAX_DOCUMENT_CHARS + 1), rules=DEFAULT_RULES)


class TestExportRequest:
    def test_valid_docx(self):
        req = ExportRequest(document="x" * 20, rules=DEFAULT_RULES, format="docx")
        assert req.format == "docx"

    def test_valid_pdf(self):
        req = ExportRequest(document="x" * 20, rules=DEFAULT_RULES, format="pdf")
        assert req.format == "pdf"

    def test_invalid_format(self):
        with pytest.raises(ValidationError):
            ExportRequest(document="x" * 20, rules=DEFAULT_RULES, format="txt")


class TestReferenceStyle:
    def test_all_values(self):
        for val in ("APA", "MLA", "Chicago", "Harvard", "IEEE", "none"):
            req = GenerateCitationsRequest(document="x" * 20, style=val)
            assert req.style.value == val
