# Pitchdeck Assistant

AI-powered pitch deck analysis for investors. Screens decks in under 90 seconds and delivers a scorecard, due diligence questions, and a narrative investment memo grounded in the firm's thesis.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15, TypeScript, Tailwind CSS |
| Backend | FastAPI, Python 3.12, SQLAlchemy 2 (async) |
| Queue | Celery + Redis |
| Database | PostgreSQL 16 + pgvector |
| LLM | LiteLLM → Mistral (prototype) → Claude/GPT-4o (production) |
| Observability | Langfuse (self-hosted) |
| Auth | Clerk (issue #2) |

## Local Development

### Prerequisites

- Docker & Docker Compose
- (Optional) Python 3.12 + Node 22 for local editing without containers

### Start

```bash
cp .env.example .env
# Fill in MISTRAL_API_KEY at minimum

docker compose up
```

Services:
| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API docs | http://localhost:8000/docs |
| Langfuse | http://localhost:3001 |

### Health check

```bash
curl http://localhost:8000/health
```

### Run backend tests locally

```bash
cd backend
pip install -e ".[dev]"
pytest
```

### Run backend linting

```bash
cd backend
ruff check .
mypy app
```

## Architecture

See [`docs/PRD-v1-investor.md`](docs/PRD-v1-investor.md) for the full product spec.

### Issue tracker

Issues are tracked on [GitHub Issues](https://github.com/GabrielGst/pitchdeck-assistant/issues). Slices are built in dependency order — see issue #1 through #12.

## Project Structure

```
pitchdeck-assistant/
├── backend/            # FastAPI application
│   ├── app/
│   │   ├── api/        # Route handlers
│   │   ├── core/       # Config, database engine
│   │   ├── models/     # SQLAlchemy models
│   │   └── worker/     # Celery app and tasks
│   ├── alembic/        # Database migrations
│   └── tests/
├── frontend/           # Next.js application
│   └── src/app/
├── docs/               # PRD and architecture docs
└── docker-compose.yml
```
