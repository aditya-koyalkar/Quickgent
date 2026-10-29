from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class WorkflowExecuteRequest(BaseModel):
    workflow: Dict[str, Any] = Field(..., description="Canonical or Visual workflow graph JSON")
    inputs: Dict[str, Any] = Field(default_factory=dict, description="Inputs for workflow start node (e.g. user_message)")
    session_id: Optional[str] = Field(None, description="Optional session ID for tracing")
    conversation_history: Optional[List[Dict[str, str]]] = Field(
        default=None,
        description="Optional recent message history for multi-turn conversational agents"
    )
    api_key: Optional[str] = Field(None, description="Optional override API key")


class ToolCallTrace(BaseModel):
    id: str
    tool_name: str
    arguments: Dict[str, Any]
    result: Any
    duration_ms: float
    status: str = "success"


class NodeExecutionTrace(BaseModel):
    node_id: str
    node_name: str
    node_type: str
    status: str = "success"
    input_data: Dict[str, Any] = Field(default_factory=dict)
    output_data: Dict[str, Any] = Field(default_factory=dict)
    selected_route: Optional[str] = None
    tool_calls: Optional[List[ToolCallTrace]] = None
    token_usage: Optional[Dict[str, int]] = None
    duration_ms: float = 0.0
    error: Optional[str] = None
    started_at: str
    finished_at: str


class WorkflowExecuteResponse(BaseModel):
    execution_id: str
    status: str = "completed"  # "completed" | "failed"
    response_text: str
    outputs: Dict[str, Any] = Field(default_factory=dict)
    state: Dict[str, Any] = Field(default_factory=dict)
    step_traces: List[NodeExecutionTrace] = Field(default_factory=list)
    total_duration_ms: float = 0.0
    total_tokens: int = 0

