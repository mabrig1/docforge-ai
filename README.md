# DocForge AI v2 — Smart Document Formatter

AI-powered document formatting: describe your style in plain English, get a professionally
formatted document with proper academic citations.

## What's New in v2

- **Precision AI prompts** — structure detection and citation formatting are significantly more accurate
- **Performance** — memoized components, AbortController for cancellable requests, lazy parsing
- **Editorial UI** — Newsreader + Outfit typography, paper-simulation preview, pipeline progress, shimmer loading
- **Expanded formatting** — H3 support, first-line indent, italic headings, small caps, paragraph spacing
- **Drag & drop** file upload
- **Raw view** — inspect tagged output alongside preview and JSON rules
- **Better export** — improved DOCX fidelity with proper run formatting

## Architecture

```
ai-doc-formatter/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry, CORS, error handling
│   │   ├── config.py            # Env config
│   │   ├── models/schemas.py    # Pydantic v2 models
│   │   ├── routers/
│   │   │   ├── formatting.py    # /parse-instruction, /format-document
│   │   │   ├── citations.py     # /generate-citations
│   │   │   └── export.py        # /export (docx/pdf)
│   │   └── services/
│   │       ├── ai_service.py    # Claude API with precision prompts
│   │       └── export_service.py # python-docx + reportlab
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # Main component (backend mode)
│   │   ├── main.jsx             # Entry point
│   │   └── utils/api.js         # API client with AbortController
│   ├── vite.config.js
│   └── package.json
└── README.md
```

## Quick Start

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # add ANTHROPIC_API_KEY
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install && npm run dev
```

Open **http://localhost:3000**

## API

| Endpoint                 | Description                     |
|--------------------------|---------------------------------|
| POST /api/parse-instruction | NL instructions → JSON rules |
| POST /api/format-document   | Raw text → tagged structure  |
| POST /api/generate-citations | Apply citation style         |
| POST /api/export            | Download .docx or .pdf       |

## Standalone Mode

The `.jsx` artifact runs in Claude.ai without a backend — it calls the
Anthropic Messages API directly for parsing, structuring, and citations.
Backend is needed only for .docx/.pdf export.

## License

MIT
