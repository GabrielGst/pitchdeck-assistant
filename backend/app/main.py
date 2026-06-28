from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.api.routes.deals import router as deals_router
from app.api.routes.decks import router as decks_router
from app.api.users import router as users_router
from app.core.config import settings

app = FastAPI(
    title="Pitchdeck Assistant API",
    version="0.1.0",
    debug=settings.debug,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, tags=["system"])
app.include_router(users_router)
app.include_router(decks_router)
app.include_router(deals_router)
