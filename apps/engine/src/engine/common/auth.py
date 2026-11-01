import os
import time
import hmac
import hashlib
import logging
from typing import Optional
from fastapi import Request, HTTPException

logger = logging.getLogger("engine.common.auth")

# Shared internal secret for inter-service authentication
INTERNAL_ENGINE_SECRET = (
    os.environ.get("INTERNAL_ENGINE_SECRET")
    or os.environ.get("ENGINE_API_SECRET")
    or "quickgent_engine_internal_secret_key_2026"
).strip()

# Maximum permitted clock skew / replay attack window (5 minutes)
MAX_TIMESTAMP_SKEW_SECONDS = 300


def generate_engine_signature(
    timestamp: str,
    method: str,
    path: str,
    secret: Optional[str] = None,
) -> str:
    """
    Generates an HMAC-SHA256 signature for server-to-server request authentication.
    Payload: "{timestamp}:{method}:{normalized_path}"
    """
    key = (secret or INTERNAL_ENGINE_SECRET).encode("utf-8")
    # Normalize path by removing trailing slash (unless root)
    normalized_path = path.rstrip("/") if path != "/" else "/"
    payload = f"{timestamp}:{method.upper()}:{normalized_path}".encode("utf-8")
    return hmac.new(key, payload, hashlib.sha256).hexdigest()


def verify_engine_request(request: Request) -> bool:
    """
    Validates that the incoming request came from an authenticated internal service (Quickgent API).
    Verifies:
    1. Timestamp presence and freshness within 5 minutes (prevents replay attacks)
    2. HMAC-SHA256 cryptographic signature match
    3. Fallback to direct Bearer secret check if configured
    """
    auth_header = request.headers.get("authorization", "").strip()
    timestamp_header = request.headers.get("x-engine-timestamp", "").strip()
    signature_header = request.headers.get("x-engine-signature", "").strip()

    # Direct Bearer secret match fallback
    expected_bearer = f"Bearer {INTERNAL_ENGINE_SECRET}"
    if auth_header and hmac.compare_digest(auth_header, expected_bearer) and not timestamp_header:
        return True

    if not timestamp_header or not signature_header:
        logger.warning(
            f"Unauthorized engine access attempt to {request.method} {request.url.path} - missing auth headers"
        )
        raise HTTPException(
            status_code=401,
            detail="Unauthorized: Missing X-Engine-Timestamp or X-Engine-Signature headers",
        )

    # 1. Replay attack and clock skew check
    try:
        req_time = float(timestamp_header)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=401,
            detail="Unauthorized: Invalid X-Engine-Timestamp format",
        )

    current_time = time.time()
    time_delta = abs(current_time - req_time)
    if time_delta > MAX_TIMESTAMP_SKEW_SECONDS:
        logger.warning(
            f"Clock skew / expired request to {request.url.path}: delta={time_delta:.1f}s (max {MAX_TIMESTAMP_SKEW_SECONDS}s)"
        )
        raise HTTPException(
            status_code=401,
            detail=f"Unauthorized: Request timestamp expired or clock skew too large ({time_delta:.1f}s)",
        )

    # 2. Verify HMAC Signature
    normalized_path = request.url.path.rstrip("/") if request.url.path != "/" else "/"
    expected_sig = generate_engine_signature(
        timestamp=str(int(req_time)),
        method=request.method,
        path=normalized_path,
        secret=INTERNAL_ENGINE_SECRET,
    )

    if not hmac.compare_digest(expected_sig, signature_header):
        # Also try with raw path in case of exact match variation
        alt_expected = generate_engine_signature(
            timestamp=timestamp_header,
            method=request.method,
            path=request.url.path,
            secret=INTERNAL_ENGINE_SECRET,
        )
        if not hmac.compare_digest(alt_expected, signature_header):
            logger.warning(
                f"Invalid engine signature for {request.method} {request.url.path} from client {request.client.host if request.client else 'unknown'}"
            )
            raise HTTPException(
                status_code=403,
                detail="Forbidden: Invalid engine signature",
            )

    return True

