# DataFlow AI — Backend

FastAPI backend for website scraping, AI analysis, and job processing.

## Stack

- **FastAPI** — async REST API
- **PostgreSQL** + SQLAlchemy (async)
- **Redis** + **Celery** — background jobs
- **Playwright** — browser scraping
- **BeautifulSoup** — HTML parsing
- **OpenAI** — business analysis
- **WebSockets** — realtime job updates
- **JWT** — authentication

## Project structure

```
backend/
├── app/
│   ├── main.py              # FastAPI entry
│   ├── config.py
│   ├── database.py
│   ├── models/              # SQLAlchemy tables
│   ├── schemas/             # Pydantic DTOs
│   ├── repositories/        # DB access
│   ├── services/            # Business logic + scraper + AI
│   ├── routers/             # API routes
│   ├── tasks/               # Celery tasks
│   └── websocket/           # Realtime updates
├── docker-compose.yml
├── requirements.txt
└── .env.example
```

## Manual setup (Windows / local)

### 1. Python 3.11+

```bash
python --version
```

### 2. Virtual environment

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium
```

### 3. PostgreSQL & Redis

**Option A — Docker (recommended):**

```bash
docker compose up -d postgres redis
```

**Option B — Install locally** and update `.env` URLs.

### 4. Environment file

```bash
copy .env.example .env
```

Edit `.env`:

- `SECRET_KEY` — long random string
- `OPENAI_API_KEY` — your OpenAI key (optional; fallback analysis works without it)
- `SYNC_JOBS=true` — run jobs without Celery (easiest for first test)

### 5. Start API

```bash
uvicorn app.main:app --reload --port 8000
```

API docs: **http://localhost:8000/docs**

### 6. (Optional) Celery worker

If `SYNC_JOBS=false`, start worker in another terminal:

```bash
celery -A app.celery_app worker --loglevel=info -P solo
```

> On Windows use `-P solo` pool.

### 7. Connect frontend

In `frontend/.env`:

```
VITE_API_URL=http://localhost:8000/api/v1
VITE_WS_URL=ws://localhost:8000
```

## API endpoints (matches frontend)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/register` | Register |
| POST | `/api/v1/auth/login` | Login |
| GET | `/api/v1/jobs` | List jobs |
| POST | `/api/v1/jobs/single` | Start single scrape |
| POST | `/api/v1/jobs/bulk` | Upload CSV |
| GET | `/api/v1/dashboard/stats` | Dashboard stats |
| GET | `/api/v1/jobs/{id}/extracted` | Extracted data |
| GET | `/api/v1/jobs/{id}/ai-analysis` | AI analysis |
| GET | `/api/v1/exports/{id}?format=csv` | Export |
| WS | `/ws?token=` | Global updates |
| WS | `/ws/jobs/{id}?token=` | Job updates |

## Full Docker stack

```bash
copy .env.example .env
docker compose up --build
```

Runs: API (8000), Celery worker, PostgreSQL, Redis.

## Database tables

- `users`, `jobs`, `websites`, `extracted_data`, `ai_analysis`, `exports`, `logs`

Tables auto-create on startup via SQLAlchemy `create_all`.
