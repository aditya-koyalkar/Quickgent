import logging
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from .schemas import WorkflowExecuteRequest, WorkflowExecuteResponse
from .executor import WorkflowExecutor

logger = logging.getLogger("engine.workflow.router")

router = APIRouter()


@router.post("/execute", response_model=WorkflowExecuteResponse)
@router.post("/run", response_model=WorkflowExecuteResponse)
async def execute_workflow_endpoint(request: WorkflowExecuteRequest) -> WorkflowExecuteResponse:
    """
    Executes a workflow graph JSON step-by-step with inputs.
    Runs LLM, Agents, Tools, Condition routing, and Transformations.
    """
    logger.info(f"Received workflow execution request with inputs: {list(request.inputs.keys())}")
    executor = WorkflowExecutor(api_key=request.api_key)
    return await executor.execute(request)


@router.post("/execute/stream")
@router.post("/run/stream")
async def execute_workflow_stream_endpoint(request: WorkflowExecuteRequest):
    """
    Streams a workflow graph execution using Server-Sent Events (SSE).
    Yields node_start, token chunks, tool_call, node_end, and done events in real-time.
    """
    logger.info(f"Received streaming workflow execution request with inputs: {list(request.inputs.keys())}")
    executor = WorkflowExecutor(api_key=request.api_key)
    return StreamingResponse(
        executor.execute_stream(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


