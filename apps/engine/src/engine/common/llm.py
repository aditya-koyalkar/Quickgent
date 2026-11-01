import os
import logging
from typing import Any, List, Optional, Tuple, Type
from pydantic import BaseModel

logger = logging.getLogger("engine.common.llm")

# Primary cheapest model (Flash-Lite tier) and sequential fallback chain
DEFAULT_PRIMARY_MODEL = "gemini-flash-lite-latest"
FALLBACK_MODEL_CHAIN = [
    "gemini-flash-lite-latest",
    "gemini-3.5-flash-lite",
    "gemini-3.5-flash",
    "gemini-3.8-flash",
]


def resolve_candidate_models(requested_model: Optional[str] = None) -> List[str]:
    """
    Resolves the requested model and returns a deduplicated candidate chain
    ordered by preference, automatically mapping legacy/deprecated names.
    """
    env_default = os.environ.get("GEMINI_MODEL") or DEFAULT_PRIMARY_MODEL
    primary = (requested_model or env_default).strip()

    # Map legacy / discontinued model aliases to current flash-lite
    if any(d in primary.lower() for d in ("gemini-2.5", "gemini-1.5", "gemini-2.0")):
        primary = DEFAULT_PRIMARY_MODEL
    elif "gemini" not in primary.lower():
        primary = env_default

    candidates = [primary]
    for m in FALLBACK_MODEL_CHAIN:
        if m not in candidates:
            candidates.append(m)

    return candidates


def get_llm(
    model_name: Optional[str] = None,
    temperature: float = 0.7,
    google_api_key: Optional[str] = None,
    max_retries: int = 1,
):
    """
    Returns a configured ChatGoogleGenerativeAI instance.
    """
    from langchain_google_genai import ChatGoogleGenerativeAI

    api_key = (
        google_api_key
        or os.environ.get("GOOGLE_API_KEY")
        or os.environ.get("GEMINI_API_KEY")
    )
    if api_key:
        api_key = api_key.strip()

    target_model = resolve_candidate_models(model_name)[0]

    return ChatGoogleGenerativeAI(
        model=target_model,
        google_api_key=api_key,
        temperature=temperature,
        max_retries=max_retries,
    )


async def invoke_llm_with_fallback(
    messages: List[Any],
    model_name: Optional[str] = None,
    temperature: float = 0.7,
    google_api_key: Optional[str] = None,
    structured_schema: Optional[Type[BaseModel]] = None,
) -> Tuple[Any, str]:
    """
    Executes an async LLM call (standard or structured output) across the candidate
    model fallback chain. Automatically switches model on 503, rate limits, or transient errors.
    Returns (result, used_model_name).
    """
    from langchain_google_genai import ChatGoogleGenerativeAI

    api_key = (
        google_api_key
        or os.environ.get("GOOGLE_API_KEY")
        or os.environ.get("GEMINI_API_KEY")
    )
    if api_key:
        api_key = api_key.strip()

    candidates = resolve_candidate_models(model_name)
    last_error: Optional[Exception] = None

    for cand in candidates:
        try:
            logger.info(f"Invoking LLM with model='{cand}' (temp={temperature}, structured={bool(structured_schema)})...")
            model = ChatGoogleGenerativeAI(
                model=cand,
                google_api_key=api_key,
                temperature=temperature,
                max_retries=1,
            )

            if structured_schema:
                runnable = model.with_structured_output(structured_schema)
                res = await runnable.ainvoke(messages)
            else:
                res = await model.ainvoke(messages)

            logger.info(f"LLM call succeeded using model='{cand}'")
            return res, cand

        except Exception as e:
            err_str = str(e)
            logger.warning(f"Model '{cand}' failed ({err_str[:120]}). Trying next fallback candidate...")
            last_error = e

            # Do not retry if the API key is outright invalid
            if "400" in err_str and "API_KEY_INVALID" in err_str:
                raise

            continue

    raise last_error or RuntimeError("All candidate models failed during LLM execution.")


async def astream_llm_with_fallback(
    messages: List[Any],
    model_name: Optional[str] = None,
    temperature: float = 0.7,
    google_api_key: Optional[str] = None,
):
    """
    Streams LLM tokens chunk by chunk, with fallback model support if initialization fails.
    Yields (chunk, used_model_name).
    """
    from langchain_google_genai import ChatGoogleGenerativeAI

    api_key = (
        google_api_key
        or os.environ.get("GOOGLE_API_KEY")
        or os.environ.get("GEMINI_API_KEY")
    )
    if api_key:
        api_key = api_key.strip()

    candidates = resolve_candidate_models(model_name)
    last_error: Optional[Exception] = None

    for cand in candidates:
        has_yielded = False
        try:
            logger.info(f"Streaming LLM with model='{cand}' (temp={temperature})...")
            model = ChatGoogleGenerativeAI(
                model=cand,
                google_api_key=api_key,
                temperature=temperature,
                max_retries=1,
            )
            async for chunk in model.astream(messages):
                has_yielded = True
                yield chunk, cand
            return
        except Exception as e:
            err_str = str(e)
            logger.warning(f"Streaming model '{cand}' failed ({err_str[:120]}). Trying next candidate...")
            last_error = e
            if has_yielded:
                raise
            if "400" in err_str and "API_KEY_INVALID" in err_str:
                raise
            continue

    raise last_error or RuntimeError("All candidate models failed during LLM streaming.")


