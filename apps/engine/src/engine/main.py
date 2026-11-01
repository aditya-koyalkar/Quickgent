import os
from typing import List
from dotenv import load_dotenv

load_dotenv()

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from .logging_config import setup_logging
from .copilot import router as copilot_router
from .workflow import router as workflow_router
from .common.auth import verify_engine_request

# Initialize centralized logging
logger = setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing Quickgent Engine services in stateless compute mode...")
    yield
    logger.info("Shutting down Quickgent Engine services...")


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


@app.middleware("http")
async def server_to_server_auth_middleware(request: Request, call_next):
    """
    Enforces time-based HMAC cryptographic signature authentication on all internal Engine APIs.
    Allows unauthenticated access only to /health, OpenAPI docs, and CORS preflight OPTIONS.
    """
    if request.method == "OPTIONS":
        return await call_next(request)

    path = request.url.path
    if path in ("/health", "/docs", "/openapi.json", "/redoc") or path.startswith("/static"):
        return await call_next(request)

    try:
        verify_engine_request(request)
    except HTTPException as http_err:
        return JSONResponse(
            status_code=http_err.status_code,
            content={"detail": http_err.detail},
        )
    except Exception as err:
        logger.error(f"Internal auth validation error: {err}")
        return JSONResponse(
            status_code=401,
            content={"detail": "Unauthorized engine request"},
        )

    return await call_next(request)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "quickgent-engine",
        "mode": "stateless-compute",
        "auth": "hmac-sha256-enabled",
    }


app.include_router(copilot_router, prefix="/copilot", tags=["Copilot"])
app.include_router(workflow_router, prefix="/workflow", tags=["Workflow"])

