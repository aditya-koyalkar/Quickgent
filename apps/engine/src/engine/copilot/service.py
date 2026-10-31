import os
import json
import time
import logging
from typing import Any
from fastapi import HTTPException
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

from .prompts import COPILOT_SYSTEM_PROMPT
from ..common.llm import invoke_llm_with_fallback
from .schemas import (
    CopilotGenerateRequest,
    CopilotGenerateResponse,
    CopilotOutputSchema,
    validate_canonical_graph,
)

logger = logging.getLogger("engine.copilot.service")


async def execute_copilot_generation(req: CopilotGenerateRequest) -> CopilotGenerateResponse:
    """
    Executes workflow generation using Google Gemini (via LangChain structured output)
    with conversation context and current workflow JSON.
    """
    start_time = time.perf_counter()
    history_count = len(req.messages)
    has_existing_workflow = req.current_workflow is not None
    instruction_preview = req.instruction[:70] + ("..." if len(req.instruction) > 70 else "")

    logger.info(
        f"Copilot request received | instruction='{instruction_preview}' | "
        f"history_messages={history_count} | has_current_workflow={has_existing_workflow}"
    )

    raw_key = req.api_key or os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    google_api_key = raw_key.strip() if (raw_key and raw_key.strip()) else None

    if not google_api_key:
        logger.error("Authentication failed: No Gemini API key provided or found in environment.")
        raise HTTPException(
            status_code=400,
            detail="Gemini API key is required. Please set GOOGLE_API_KEY or GEMINI_API_KEY in the environment or request."
        )

    try:
        chat_messages: list[Any] = [SystemMessage(content=COPILOT_SYSTEM_PROMPT)]

        # Append previous conversation history
        for msg in req.messages[-10:]:
            if msg.role == "user":
                chat_messages.append(HumanMessage(content=msg.content))
            elif msg.role == "assistant":
                chat_messages.append(AIMessage(content=msg.content))

        # Build prompt with current workflow snapshot
        prompt_content = f"User Request: {req.instruction}\n\n"
        if req.current_workflow:
            prompt_content += (
                f"CURRENT WORKFLOW JSON (modify or enhance this):\n"
                f"```json\n{json.dumps(req.current_workflow, indent=2)}\n```\n"
            )
        else:
            prompt_content += "Create a brand new workflow meeting this requirement or ask clarification questions if critical details are missing.\n"

        chat_messages.append(HumanMessage(content=prompt_content))

        generated: CopilotOutputSchema
        generated, used_model = await invoke_llm_with_fallback(
            messages=chat_messages,
            temperature=0.2,
            google_api_key=google_api_key,
            structured_schema=CopilotOutputSchema,
        )

        duration = time.perf_counter() - start_time
        workflow_dump = None

        if generated.workflow:
            # Validate DAG structure
            validate_canonical_graph(generated.workflow)
            workflow_dump = generated.workflow.model_dump()
            node_count = len(generated.workflow.nodes)
            edge_count = len(generated.workflow.edges)
            workflow_name = generated.workflow.workflow.name
            logger.info(
                f"Copilot generated workflow in {duration:.2f}s | "
                f"workflow='{workflow_name}' | nodes={node_count} | edges={edge_count}"
            )
        else:
            logger.info(
                f"Copilot requested clarification in {duration:.2f}s | "
                f"needs_clarification={generated.needs_clarification} | "
                f"questions={generated.clarification_questions}"
            )

        return CopilotGenerateResponse(
            explanation=generated.explanation,
            architecture_highlights=generated.architecture_highlights or [],
            workflow=workflow_dump,
            needs_clarification=generated.needs_clarification,
            clarification_questions=generated.clarification_questions,
            metadata={
                "model": used_model,
                "provider": "google",
                "duration_seconds": round(duration, 3),
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        duration = time.perf_counter() - start_time
        logger.error(
            f"Copilot generation failed after {duration:.2f}s: {e}",
            exc_info=True
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate workflow with Gemini AI: {str(e)}"
        )
