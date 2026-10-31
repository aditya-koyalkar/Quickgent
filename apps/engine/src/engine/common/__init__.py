"""
Common shared utilities and clients for Quickgent Engine.
"""
from .llm import (
    DEFAULT_PRIMARY_MODEL,
    FALLBACK_MODEL_CHAIN,
    resolve_candidate_models,
    get_llm,
    invoke_llm_with_fallback,
)

__all__ = [
    "DEFAULT_PRIMARY_MODEL",
    "FALLBACK_MODEL_CHAIN",
    "resolve_candidate_models",
    "get_llm",
    "invoke_llm_with_fallback",
]

