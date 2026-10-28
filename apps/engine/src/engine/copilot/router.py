from fastapi import APIRouter
from .schemas import CopilotGenerateRequest, CopilotGenerateResponse
from .service import execute_copilot_generation

router = APIRouter()


@router.post("/generate", response_model=CopilotGenerateResponse)
async def generate_workflow(request: CopilotGenerateRequest) -> CopilotGenerateResponse:
    """Generate or iteratively update a workflow graph from instructions and context."""
    return await execute_copilot_generation(request)
