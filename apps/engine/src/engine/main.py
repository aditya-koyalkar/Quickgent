import os
from typing import List
from dotenv import load_dotenv

load_dotenv()

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .logging_config import setup_logging
from .copilot import router as copilot_router
from .workflow import router as workflow_router
from .common.persistence import init_persister, close_persister, get_persister

# Initialize centralized logging
logger = setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing Quickgent Engine services...")
    try:
        await init_persister()
    except Exception as e:
        logger.warning(f"Engine persister startup warning: {e}")
    yield
    logger.info("Shutting down Quickgent Engine services...")
    try:
        await close_persister()
    except Exception as e:
        logger.error(f"Engine persister shutdown error: {e}")


app = FastAPI(title="Quickgent Engine", version="1.0.0", lifespan=lifespan)

# CORS Configuration from env, falling back to local port 3000
env_origins = (os.environ.get("ENGINE_CORS_ORIGINS") or os.environ.get("CORS_ORIGINS", "")).strip()
if env_origins:
    allowed_origins: List[str] = [
        o.strip() for o in env_origins.split(",") if o.strip()
    ]
else:
    allowed_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

is_wildcard = len(allowed_origins) == 1 and allowed_origins[0] == "*"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if is_wildcard else allowed_origins,
    allow_credentials=not is_wildcard,
    allow_methods=["*"],
    allow_headers=["*"],
    max_age=600,
)

@app.get("/health")
async def health():
    persister = get_persister()
    db_connected = persister.is_connected and persister.pool is not None
    return {
        "status": "ok" if db_connected else "degraded",
        "service": "quickgent-engine",
        "database": "connected" if db_connected else "disconnected",
        "active_url": persister.active_url.split("@")[-1] if persister.active_url and "@" in persister.active_url else persister.active_url,
    }

app.include_router(copilot_router, prefix="/copilot", tags=["Copilot"])
app.include_router(workflow_router, prefix="/workflow", tags=["Workflow"])
