"""
AI Service v2 — Refined Claude API integration with precision prompts.
"""

import json
import logging
import re
import anthropic
from app.config import config

logger = logging.getLogger(__name__)

client = anthropic.AsyncAnthropic(api_key=config.ANTHROPIC_API_KEY)

PROMPT_PARSE = """You are a document formatting engine. Convert the user's natural language formatting instruction into a JSON object. Return ONLY raw JSON — no markdown fences, no prose.

Schema (fill every field, use sensible academic defaults for unspecified fields):
{
  "font": "string",
  "body_size": "string e.g. '12pt'",
  "line_spacing": "string e.g. '2.0'",
  "paragraph_spacing_after": "string e.g. '8pt'",
  "heading_1": { "size": "string", "bold": true, "italic": false, "color": "#hex", "alignment": "left|center", "caps": false },
  "heading_2": { "size": "string", "bold": true, "italic": false, "color": "#hex" },
  "heading_3": { "size": "string", "bold": true, "italic": false, "color": "#hex" },
  "alignment": "justified|left|center|right",
  "margins": "string e.g. '1 inch'",
  "referencing": "APA|MLA|Chicago|Harvard|IEEE|none",
  "first_line_indent": "string e.g. '0.5 inch' or 'none'"
}"""

PROMPT_STRUCTURE = """You are a precision document structure analyzer.

TAGS (exactly one per output line):
  [TITLE] [H1] [H2] [H3] [PARAGRAPH] [REFERENCES] [REF]

RULES:
1. Every non-empty output line starts with exactly one tag.
2. Do NOT split or merge paragraphs.
3. Preserve the author's exact words.
4. Short standalone lines before body text are headings.
5. After "References"/"Bibliography"/"Works Cited", every entry gets [REF].
6. Return ONLY tagged output — no commentary."""


def _cite_prompt(style: str) -> str:
    return f"""You are an expert {style} citation formatter.
INPUT: A document with structure tags.
TASKS:
1. Reformat in-text citations to {style} style.
2. Reformat [REF] entries to {style} style.
3. Ensure citations match references.
4. Alphabetize references (or number for IEEE).
CRITICAL: Keep ALL tags intact. No commentary. Return ONLY the tagged document."""


FALLBACK = {
    "font": "Times New Roman", "body_size": "12pt", "line_spacing": "2.0",
    "heading_1": {"size": "14pt", "bold": True, "color": "#000000"},
    "heading_2": {"size": "12pt", "bold": True, "italic": True, "color": "#333"},
    "alignment": "justified", "referencing": "APA", "margins": "1 inch",
    "first_line_indent": "0.5 inch",
}

_JSON_FENCE_RE = re.compile(r"```(?:json)?\s*([\s\S]*?)```", re.IGNORECASE)


def _extract_json(raw: str) -> dict:
    """Extract JSON from raw text, stripping markdown fences if present."""
    match = _JSON_FENCE_RE.search(raw)
    text = match.group(1) if match else raw
    return json.loads(text.strip())


async def _call(system: str, user: str, max_tokens: int = 1024) -> str:
    msg = await client.messages.create(
        model=config.ANTHROPIC_MODEL,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    return msg.content[0].text.strip()


def _doc_max_tokens(document: str) -> int:
    """Return an output token budget sized to the document.

    Output is roughly the same length as the input (tags add ~5 %).
    We estimate ~0.75 words per token, add 20 % headroom, and cap at
    16 000 — the safe ceiling for claude-sonnet-4.
    """
    word_count = len(document.split())
    estimated_output = int(word_count / 0.75 * 1.20)
    return max(1024, min(estimated_output, 16_000))


async def parse_formatting_instructions(instruction: str) -> tuple[dict, bool]:
    """Returns (rules_dict, used_fallback). JSON output is small — 512 tokens is plenty."""
    raw = await _call(PROMPT_PARSE, instruction, max_tokens=512)
    try:
        return _extract_json(raw), False
    except (json.JSONDecodeError, ValueError):
        logger.warning("Claude returned non-JSON for instruction parse; using fallback defaults")
        return FALLBACK.copy(), True


async def detect_document_structure(document: str) -> str:
    return await _call(PROMPT_STRUCTURE, document, max_tokens=_doc_max_tokens(document))


async def format_citations(document: str, style: str) -> str:
    return await _call(_cite_prompt(style), document, max_tokens=_doc_max_tokens(document))
