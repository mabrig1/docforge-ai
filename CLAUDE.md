# CLAUDE.md — DocForge AI

AI assistant guide for the DocForge AI codebase. Read this before making any changes.

---

## Repository Layout

```
docforge-ai/
├── backend/                  Python / FastAPI
│   ├── app/
│   │   ├── main.py           App factory, lifespan, middleware, router registration
│   │   ├── config.py         Env-var config (dataclass, imported as `config`)
│   │   ├── database.py       SQLAlchemy SQLite engine + get_db dependency
│   │   ├── dependencies.py   FastAPI deps: get_current_user, require_admin, track_usage
│   │   ├── models/
│   │   │   ├── user.py       SQLAlchemy User ORM model
│   │   │   └── schemas.py    Pydantic v2 request/response schemas
│   │   ├── routers/
│   │   │   ├── auth.py       /api/auth/* — register, login, me, admin user mgmt
│   │   │   ├── formatting.py /api/parse-instruction, /api/format-document
│   │   │   ├── citations.py  /api/generate-citations
│   │   │   ├── export.py     /api/export (docx / pdf)
│   │   │   └── upload.py     /api/extract-text (file → plain text)
│   │   └── services/
│   │       ├── ai_service.py    AsyncAnthropic client + prompts
│   │       ├── auth_service.py  stdlib JWT (HS256) + passlib sha256_crypt
│   │       └── export_service.py python-docx + reportlab PDF
│   ├── tests/
│   │   ├── conftest.py           FakeUser stub + apply_auth_override helper
│   │   ├── test_api_endpoints.py Integration tests (Anthropic mocked)
│   │   ├── test_ai_service.py    Unit tests for ai_service helpers
│   │   └── test_schemas.py       Pydantic schema validation tests
│   ├── requirements.txt
│   └── pytest.ini
├── frontend/                 React 18 / Vite
│   ├── src/
│   │   ├── App.jsx           Single-page app (all state lives here)
│   │   ├── LoginPage.jsx     Auth gate (login + register form)
│   │   ├── main.jsx          Vite entry point
│   │   └── utils/
│   │       ├── api.js        All backend fetch calls (auth headers, 401 handling)
│   │       └── auth.js       localStorage token helpers
│   ├── vite.config.js        Dev proxy: /api → localhost:8000
│   └── package.json
├── CLAUDE.md                 This file
└── README.md
```

---

## Quick Start

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
# Create .env with at minimum:
# ANTHROPIC_API_KEY=sk-ant-...
# SECRET_KEY=<random 64-char hex>
# ADMIN_PASSWORD=<secure password>
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev          # http://localhost:3000
```

On first backend start, the SQLite DB is created and the admin account is seeded automatically.

---

## Environment Variables

All config lives in `backend/app/config.py` as a dataclass. Defaults are shown.

| Variable | Default | Notes |
|----------|---------|-------|
| `ANTHROPIC_API_KEY` | `""` | **Required in production** |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-20250514` | Change to test with different models |
| `SECRET_KEY` | random on each start | **Set a fixed value in production** — random means all tokens invalidate on restart |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` (24 h) | JWT lifetime |
| `ADMIN_EMAIL` | `admin@docforge.ai` | Admin account email |
| `ADMIN_PASSWORD` | `Admin@DocForge2024` | **Change before deployment** |
| `ADMIN_NAME` | `Administrator` | Display name |
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:5173` | Comma-separated |
| `HOST` | `0.0.0.0` | Uvicorn bind host |
| `PORT` | `8000` | Uvicorn port |

---

## Architecture

### Request Flow

```
Browser → Vite dev proxy (/api → :8000)
        → FastAPI (main.py)
          → CORS middleware
          → Rate limiter (slowapi, 60 req/min global)
          → Router
            → get_current_user (JWT decode + DB lookup)
            → track_usage (quota check + atomic increment)  ← only on AI routes
            → Handler
              → AI service (AsyncAnthropic)
              → DB (SQLAlchemy)
```

### Authentication

JWT is implemented **entirely in Python stdlib** (`hmac`, `hashlib`, `base64`, `json`) — no `python-jose` or `PyJWT`. This was necessary because the system `cryptography` package is broken on this environment.

- Algorithm: HS256
- Token payload: `{ sub: email, name, role, exp }`
- Storage: `localStorage` (frontend, key: `docforge_token`)
- Token expiry: 24 hours (configurable)

Password hashing uses **passlib `sha256_crypt`** — bcrypt is unavailable on this system (triggers a wrap-bug detection `ValueError`).

Do NOT switch to `bcrypt`, `python-jose`, or `PyJWT` without verifying the environment first.

### Quota / Plan System

Plans are stored on `User.plan`. Credits are consumed by AI endpoints.

| Plan | Credits | Price |
|------|---------|-------|
| `free` | 0 | No access until assigned |
| `assignment` | 5 | ₦1,000 |
| `term_paper` | 3 | ₦1,000 |
| `project` | 15 | ₦1,500 |
| Admin role | Unlimited | N/A |

**Only `format_document` and `generate_citations` consume credits.** Export and upload are always free.

Quota enforcement is in `backend/app/dependencies.py::track_usage`. It uses a **single atomic SQL UPDATE** with a `WHERE usage_count < limit` condition to avoid race conditions — do not replace this with a read-check-write pattern.

Admin assigns plans via `PATCH /api/auth/users/{id}/plan`. Assigning a plan resets `usage_count` to 0.

### AI Service

`backend/app/services/ai_service.py` contains three Claude calls:

| Function | Purpose | Token budget |
|----------|---------|-------------|
| `parse_formatting_instructions` | NL → JSON rules | 512 (JSON is small) |
| `detect_document_structure` | Add structure tags to document | `_doc_max_tokens()` |
| `format_citations` | Reformat references | `_doc_max_tokens()` |

`_doc_max_tokens(document)` computes: `max(1024, min(words / 0.75 * 1.20, 16_000))`. This prevents truncation on large documents.

The document tagging format uses these tags: `[TITLE]`, `[H1]`, `[H2]`, `[H3]`, `[PARAGRAPH]`, `[REFERENCES]`, `[REF]`. All downstream code (export service, preview renderer) depends on this format — do not change tag names without updating both.

### Database

SQLite at `backend/docforge.db` (gitignored). Schema managed manually:

- `Base.metadata.create_all()` on startup creates new tables
- `_migrate()` in `main.py` adds new columns to existing tables using `ALTER TABLE`
- **No Alembic** — add new migrations to `_migrate()` using the existing pattern

User model columns: `id`, `email`, `name`, `password_hash`, `role`, `plan`, `is_active`, `usage_count`, `created_at`.

---

## API Reference

### Public (no token required)

| Method | Path | Rate limit |
|--------|------|-----------|
| POST | `/api/auth/register` | 10/min/IP |
| POST | `/api/auth/login` | 5/min/IP |
| GET | `/health` | — |

### Authenticated (Bearer token required)

| Method | Path | Credits | Description |
|--------|------|---------|-------------|
| GET | `/api/auth/me` | — | Current user profile |
| POST | `/api/parse-instruction` | — | NL → FormattingRules JSON |
| POST | `/api/format-document` | **1** | Structure + tag document |
| POST | `/api/generate-citations` | **1** | Reformat references |
| POST | `/api/export` | — | Download `.docx` or `.pdf` |
| POST | `/api/extract-text` | — | Upload file → plain text |

### Admin only

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/auth/users` | List all users |
| PATCH | `/api/auth/users/{id}/toggle` | Enable / disable account |
| PATCH | `/api/auth/users/{id}/plan` | Assign plan (resets usage) |

---

## Frontend Conventions

- **All state lives in `App.jsx`** — no state management library.
- **All API calls go through `frontend/src/utils/api.js`** — never add raw `fetch` calls elsewhere.
- Auth token helpers are in `frontend/src/utils/auth.js` (`getToken`, `setToken`, `clearToken`, `authHeader`).
- A 401 response from any endpoint automatically calls `clearToken()` and reloads the page (implemented in `api.js::request`).
- The Vite dev server proxies `/api/*` to `localhost:8000` — no CORS issues in dev.
- `.txt` export is a **client-side Blob download** (no server round-trip needed).
- `buildRules(settings)` in `App.jsx` converts the settings panel state directly to a `FormattingRules` object, bypassing the AI parse step. Field mapping: `settings.fontSize → body_size`, `settings.spacing → line_spacing`, etc.

---

## Testing

```bash
cd backend
python -m pytest              # all 34 tests
python -m pytest -x           # stop on first failure
python -m pytest tests/test_api_endpoints.py  # integration tests only
```

### Test conventions

- `conftest.py` sets `ANTHROPIC_API_KEY=test-key` and `SECRET_KEY=test-secret-key-for-pytest-only` before any imports.
- `FakeUser` is a `@dataclass` (not a SQLAlchemy model) used to stub auth in tests. It has `role="admin"` so `track_usage` never fires quota checks.
- `apply_auth_override(app)` replaces `get_current_user` with `lambda: FakeUser()` — call it in each test that needs auth bypassed.
- Tests that call the real auth endpoints (register/login) must clean up the test user first: `db.query(User).filter(...).delete()` — the SQLite DB persists between runs.
- Mock the Anthropic client with `patch("app.services.ai_service.client", mock)` inside a `with` block, combined with a `with TestClient(app)` block inside the same scope.

### Adding a new test

```python
def test_my_endpoint():
    mock = _make_mock_client("expected ai response")
    with patch("app.services.ai_service.client", mock):
        app = _authed_app()   # applies FakeUser auth override
        with TestClient(app) as c:
            resp = c.post("/api/my-endpoint", json={...})
    assert resp.status_code == 200
```

---

## Adding New Features

### New backend route

1. Create or update a file in `backend/app/routers/`.
2. Register the router in `main.py` with the appropriate auth level:
   - Public: `app.include_router(my_router, prefix="/api")`
   - Auth required: `app.include_router(my_router, prefix="/api", dependencies=_auth)`
   - Credit-consuming: add `current_user: User = Depends(track_usage)` as a route-level parameter.
3. Add request/response schemas to `backend/app/models/schemas.py`.
4. Add tests in `backend/tests/test_api_endpoints.py`.

### New database column

Add the column to `backend/app/models/user.py`, then add an `ALTER TABLE` migration to `_migrate()` in `main.py`:

```python
if "my_column" not in existing:
    conn.execute(text("ALTER TABLE users ADD COLUMN my_column TEXT DEFAULT 'value'"))
    conn.commit()
```

### New frontend API call

Add the function to `frontend/src/utils/api.js`. Use the `request()` helper for JSON POST endpoints (it handles auth headers and 401 redirect automatically):

```js
export async function myEndpoint(data, signal) {
  const res = await request('/my-endpoint', data, signal);
  return res.json();
}
```

For non-JSON or multipart requests, use `fetch` directly with `authHeader()` and handle 401 manually.

---

## Known Constraints

- **No `bcrypt`** — passlib `sha256_crypt` is used instead. Do not add `passlib[bcrypt]` to requirements.
- **No `python-jose` or `PyJWT`** — the system `cryptography` package triggers a `pyo3_runtime.PanicException`. JWT is stdlib-only in `auth_service.py`.
- **No Alembic** — migrations are manual SQL in `_migrate()`. Keep this pattern.
- **SQLite only** — `check_same_thread=False` is set. For Postgres, remove that arg and update `DATABASE_URL`.
- **SECRET_KEY regenerates on restart** if not set in `.env` — all existing tokens are invalidated. Always set a fixed key in production.
- **Admin password default** (`Admin@DocForge2024`) is in source — always override via `ADMIN_PASSWORD` env var in production.

---

## Security Notes

- Rate limits: global 60/min, login 5/min, register 10/min (all per IP via slowapi).
- File uploads: validated by both extension and magic bytes (`PK\x03\x04` for .docx, `%PDF` for .pdf).
- CORS: restricted to configured origins, `GET/POST/PATCH` methods, `Content-Type/Authorization` headers only.
- Quota: enforced with atomic SQL (`WHERE usage_count < limit`) — race-condition safe.
- Tokens: stored in `localStorage` (XSS risk accepted for now — httpOnly cookies is a future improvement).
