# Backend Setup

PostgreSQL required. SQLite is not supported.

---

## System

| Cheez | Kahan se | Kyun |
|--------|----------|------|
| **Python 3.11+** | https://www.python.org/downloads/ | Backend |
| **PostgreSQL** | Docker (recommended) or local install | Database |

Check:
```bash
python --version
pip --version
```

---

## PostgreSQL (Docker — recommended)

```bash
cd backend
docker compose up -d postgres
```

Default connection (`.env`):
```
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/dataflow
```

---

## Python setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Core packages include `asyncpg` for PostgreSQL.

---

## API start

```bash
venv\Scripts\activate
python -m uvicorn app.main:app --reload --port 8000
```

- Health: http://localhost:8000/health  
- Swagger: http://localhost:8000/docs  

---

## Frontend

`frontend/.env`:
```
VITE_API_URL=http://localhost:8000/api/v1
VITE_WS_URL=ws://localhost:8000
```
