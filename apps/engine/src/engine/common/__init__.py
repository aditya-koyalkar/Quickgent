"""
Common shared utilities and clients for Quickgent Engine.
"""
from .llm import (
    DEFAULT_PRIMARY_MODEL,
    FALLBACK_MODEL_CHAIN,
    resolve_candidate_models,
    get_llm,
    invoke_llm_with_fallback,
    astream_llm_with_fallback,
)
from .auth import (
    INTERNAL_ENGINE_SECRET,
    generate_engine_signature,
    verify_engine_request,
)

__all__ = [
    "DEFAULT_PRIMARY_MODEL",
    "FALLBACK_MODEL_CHAIN",
    "resolve_candidate_models",
    "get_llm",
    "invoke_llm_with_fallback",
    "astream_llm_with_fallback",
    "INTERNAL_ENGINE_SECRET",
    "generate_engine_signature",
    "verify_engine_request",
]
