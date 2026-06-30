from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.api.routes.analysis import router as analysis_router
from app.api.routes.analytics import router as analytics_router
from app.api.routes.annotations import router as annotations_router
from app.api.routes.deals import router as deals_router
from app.api.routes.decks import router as decks_router
from app.api.routes.events import router as events_router
from app.api.routes.pipeline import router as pipeline_router
from app.api.routes.pipeline_config import router as pipeline_config_router
from app.api.routes.scorecard_config import router as scorecard_config_router
from app.api.routes.team import router as team_router
from app.api.routes.thesis import router as thesis_router
from app.api.users import router as users_router
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(
    title="Pitchdeck Assistant API",
    version="0.1.0",
    debug=settings.debug,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://pitchdeck-assistant.webagab.fr",
        "https://pitchdeck-assistant-dev.webagab.fr",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, tags=["system"])
app.include_router(users_router)
app.include_router(decks_router)
app.include_router(deals_router)
app.include_router(analysis_router)
app.include_router(analytics_router)
app.include_router(annotations_router)
app.include_router(events_router)
app.include_router(pipeline_config_router)
app.include_router(scorecard_config_router)
app.include_router(thesis_router)
app.include_router(pipeline_router)
app.include_router(team_router)
