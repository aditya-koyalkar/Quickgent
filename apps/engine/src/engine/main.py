import os
from typing import List
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .logging_config import setup_logging
from .copilot import router as copilot_router
from .workflow import router as workflow_router

# Initialize centralized logging
logger = setup_logging()

app = FastAPI(title="Quickgent Engine", version="1.0.0")

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
def health():
    return {"status": "ok", "service": "quickgent-engine"}

app.include_router(copilot_router, prefix="/copilot", tags=["Copilot"])
app.include_router(workflow_router, prefix="/workflow", tags=["Workflow"])
