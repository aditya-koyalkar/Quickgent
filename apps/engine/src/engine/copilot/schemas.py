from typing import Any
from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: str = Field(description="Role of message author: 'user', 'assistant', or 'system'")
    content: str = Field(description="Content text of message")


class CanonicalWorkflowInfo(BaseModel):
    name: str = Field(description="Descriptive name of the agent workflow")
    version: str = Field(default="1.0.0", description="Semantic version string")
    description: str = Field(description="Comprehensive summary of what this workflow accomplishes")


class WorkflowNode(BaseModel):
    id: str = Field(description="Unique node identifier, e.g. node_start, node_llm_1")
    type: str = Field(
        description="Node type. Must be one of: start, llm, agent, condition, http_request, transform, structured_output, end"
    )
    name: str = Field(description="Human readable title of the node")
    description: str | None = Field(default=None, description="Clear description of the node's responsibility")
    position: dict[str, int] = Field(description="Coordinates on visual canvas: {'x': int, 'y': int}")
    config: dict[str, Any] = Field(description="Node configuration dictionary matching the node type specification")


class WorkflowEdge(BaseModel):
    id: str = Field(description="Unique edge identifier, e.g. e1, e2")
    source: str = Field(description="Source node ID")
    target: str = Field(description="Target node ID")
    sourceHandle: str | None = Field(default=None, description="Route ID if source node is a condition node")
    label: str | None = Field(default=None, description="Optional label describing the edge")


class CanonicalWorkflow(BaseModel):
    schemaVersion: str = Field(default="1.0.0")
    workflow: CanonicalWorkflowInfo
    nodes: list[WorkflowNode]
    edges: list[WorkflowEdge]


class CopilotOutputSchema(BaseModel):
    explanation: str = Field(
        ...,
        description="Detailed, professional markdown explanation explaining the architectural design, each node's role, and how it addresses the conversation and user request."
    )
    architecture_highlights: list[str] = Field(
        ...,
        description="3 to 5 bullet points summarizing key architectural decisions, routing paths, or capabilities added."
    )
    workflow: CanonicalWorkflow = Field(
        ...,
        description="Strictly valid Canonical Workflow v1.0.0 DAG structure with all nodes and edges."
    )


class CopilotGenerateRequest(BaseModel):
    instruction: str
    current_workflow: dict[str, Any] | None = None
    messages: list[ChatMessage] = Field(default_factory=list)
    api_key: str | None = None


class CopilotGenerateResponse(BaseModel):
    explanation: str
    architecture_highlights: list[str]
    workflow: dict[str, Any]
    metadata: dict[str, Any] = Field(default_factory=dict)


def validate_canonical_graph(wf: CanonicalWorkflow) -> None:
    """Validates basic DAG integrity before returning to client."""
    node_ids = {n.id for n in wf.nodes}
    if len(node_ids) != len(wf.nodes):
        raise ValueError("Workflow contains duplicate node IDs.")

    types = {n.type for n in wf.nodes}
    if "start" not in types:
        raise ValueError("Workflow is missing a 'start' trigger node.")
    if "end" not in types:
        raise ValueError("Workflow is missing an 'end' node.")

    for edge in wf.edges:
        if edge.source not in node_ids:
            raise ValueError(f"Edge '{edge.id}' source '{edge.source}' does not exist in nodes.")
        if edge.target not in node_ids:
            raise ValueError(f"Edge '{edge.id}' target '{edge.target}' does not exist in nodes.")
