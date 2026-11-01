import os
import re
import json
import time
import uuid
import datetime
import logging
from typing import Any, AsyncGenerator, Dict, List, Optional, Tuple
from fastapi import HTTPException
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, ToolMessage

from .schemas import (
    WorkflowExecuteRequest,
    WorkflowExecuteResponse,
    NodeExecutionTrace,
    ToolCallTrace,
)
from .tools import safe_calculator, get_current_datetime, live_web_search
from ..common.llm import invoke_llm_with_fallback, get_llm, astream_llm_with_fallback

logger = logging.getLogger("engine.workflow.executor")


def extract_text_from_chunk(content: Any) -> str:
    """Extracts plain text string from streaming chunk content without stripping whitespace."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        texts = []
        for part in content:
            if isinstance(part, str):
                texts.append(part)
            elif isinstance(part, dict) and "text" in part:
                texts.append(part["text"])
            elif hasattr(part, "text"):
                texts.append(getattr(part, "text"))
        return "".join(texts)
    return str(content) if content is not None else ""


def extract_text_from_ai_content(content: Any) -> str:
    """Extracts plain text string from LangChain / Gemini AI response content."""
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        texts = []
        for part in content:
            if isinstance(part, str):
                texts.append(part)
            elif isinstance(part, dict) and "text" in part:
                texts.append(part["text"])
            elif hasattr(part, "text"):
                texts.append(getattr(part, "text"))
        return "\n".join(texts).strip()
    return str(content).strip()


def interpolate_template(template: str, state: Dict[str, Any]) -> str:
    """
    Interpolates variables in templates like '{{agent_output}}', '{input.user_message}', or '{{ llm_output }}'
    """
    if not template:
        return ""

    def replace_var(var_name: str) -> Optional[str]:
        key = var_name.strip()
        # 1. Direct match in state
        if key in state and state[key] is not None:
            val = state[key]
            return json.dumps(val) if isinstance(val, (dict, list)) else str(val)

        # Common input aliases:
        if key in (
            "input.user_message",
            "input.message",
            "input.text",
            "inputs.user_message",
            "inputs.message",
            "state.user_message",
            "user_message",
            "message",
        ):
            val = (
                state.get("user_message")
                or state.get("message")
                or (state.get("input", {}).get("user_message") if isinstance(state.get("input"), dict) else None)
                or (state.get("input", {}).get("message") if isinstance(state.get("input"), dict) else None)
                or (state.get("inputs", {}).get("user_message") if isinstance(state.get("inputs"), dict) else None)
                or (state.get("input") if isinstance(state.get("input"), str) else None)
            )
            if val is not None:
                return str(val)

        # Common output aliases so both agent_output and llm_output work interchangeably
        if key in ("agent_output", "llm_output", "response", "output", "text"):
            val = (
                state.get("agent_output")
                or state.get("llm_output")
                or state.get("response")
                or state.get("output")
            )
            if val is not None:
                return json.dumps(val) if isinstance(val, (dict, list)) else str(val)

        # 2. Dot notation traversal
        parts = key.split(".")
        current = state
        for p in parts:
            if isinstance(current, dict) and p in current:
                current = current[p]
            else:
                current = None
                break
        if current is not None:
            return json.dumps(current) if isinstance(current, (dict, list)) else str(current)

        # 2b. If key was input.x, inputs.x, or state.x, check if x is directly in state
        if len(parts) == 2 and parts[0] in ("input", "inputs", "state"):
            sub_key = parts[1]
            if sub_key in state and state[sub_key] is not None:
                val = state[sub_key]
                return json.dumps(val) if isinstance(val, (dict, list)) else str(val)

        # 3. Fallback to state['input'] or state['inputs']
        input_data = state.get("input") or state.get("inputs", {})
        if isinstance(input_data, dict) and key in input_data and input_data[key] is not None:
            val = input_data[key]
            return json.dumps(val) if isinstance(val, (dict, list)) else str(val)

        # 4. Environment variables & Secrets support (e.g. {{env.API_KEY}} or {{secrets.STRIPE_KEY}})
        if key.startswith("env.") or key.startswith("secrets."):
            env_var_name = key.split(".", 1)[1].strip()
            env_val = os.environ.get(env_var_name) or os.environ.get(env_var_name.upper())
            if env_val is not None:
                return env_val

        return None

    # Replace double braces {{ var }} first
    def replace_double(match):
        val = replace_var(match.group(1))
        return val if val is not None else match.group(0)

    result = re.sub(r"\{\{\s*([\w\.\-]+)\s*\}\}", replace_double, template)

    # Replace single braces { var }
    def replace_single(match):
        val = replace_var(match.group(1))
        return val if val is not None else match.group(0)

    result = re.sub(r"\{\s*([\w\.\-]+)\s*\}", replace_single, result)
    return result


def evaluate_condition_rule(rule: Dict[str, Any], state: Dict[str, Any]) -> bool:
    source_field = rule.get("sourceField", "")
    operator_type = rule.get("operator", "equals")
    comp_value = str(rule.get("comparisonValue", "")).strip().lower()

    # Resolve field value
    field_val = state.get(source_field)
    if field_val is None and isinstance(state.get("input"), dict):
        field_val = state["input"].get(source_field)

    str_val = str(field_val if field_val is not None else "").strip().lower()

    if operator_type == "equals":
        return str_val == comp_value
    elif operator_type == "not_equals":
        return str_val != comp_value
    elif operator_type == "contains":
        keywords = [k.strip() for k in comp_value.split(",") if k.strip()]
        return any(k in str_val for k in keywords)
    elif operator_type == "not_contains":
        return comp_value not in str_val
    elif operator_type == "exists":
        return field_val is not None and str_val != ""
    elif operator_type == "not_exists":
        return field_val is None or str_val == ""
    elif operator_type == "greater_than":
        try:
            return float(field_val) > float(comp_value)
        except (ValueError, TypeError):
            return False
    elif operator_type == "less_than":
        try:
            return float(field_val) < float(comp_value)
        except (ValueError, TypeError):
            return False
    return False


class WorkflowExecutor:
    """
    Executes a Workflow Graph JSON step-by-step according to the schema specifications,
    running real Gemini LLM calls, autonomous agent reasoning, tools, conditional routing,
    and data transformations.
    """

    def __init__(self, api_key: Optional[str] = None):
        raw_key = api_key or os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
        self.google_api_key = raw_key.strip() if (raw_key and raw_key.strip()) else None
        if not self.google_api_key:
            raise HTTPException(
                status_code=400,
                detail="Gemini API key is required. Set GOOGLE_API_KEY or GEMINI_API_KEY."
            )
        self.default_model = os.environ.get("GEMINI_MODEL") or "gemini-flash-lite-latest"

    async def _invoke_llm_with_fallback(
        self,
        messages: list,
        model_name: Optional[str] = None,
        temperature: float = 0.7,
    ):
        return await invoke_llm_with_fallback(
            messages=messages,
            model_name=model_name or self.default_model,
            temperature=temperature,
            google_api_key=self.google_api_key,
        )

    async def _astream_llm_with_fallback(
        self,
        messages: list,
        model_name: Optional[str] = None,
        temperature: float = 0.7,
    ):
        async for chunk, cand in astream_llm_with_fallback(
            messages=messages,
            model_name=model_name or self.default_model,
            temperature=temperature,
            google_api_key=self.google_api_key,
        ):
            yield chunk, cand

    def _get_llm(self, model_name: Optional[str] = None, temperature: float = 0.7):
        return get_llm(
            model_name=model_name or self.default_model,
            temperature=temperature,
            google_api_key=self.google_api_key,
        )

    def _normalize_graph(self, workflow_raw: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """Normalizes canonical workflow or visual workflow into standard node and edge structures."""
        nodes = workflow_raw.get("nodes", [])
        edges = workflow_raw.get("edges", [])

        # If wrapped under root
        if not nodes and "workflow" in workflow_raw and isinstance(workflow_raw["workflow"], dict):
            nodes = workflow_raw.get("workflow", {}).get("nodes", [])
            edges = workflow_raw.get("workflow", {}).get("edges", [])

        norm_nodes = []
        for n in nodes:
            node_id = n.get("id")
            node_type = (n.get("type") or "llm").lower()
            name = n.get("name") or n.get("title") or n.get("data", {}).get("label") or node_id
            config = n.get("config") or n.get("data", {}).get("config") or {}
            if not config and isinstance(n.get("data"), dict):
                config = {
                    k: v for k, v in n.get("data").items()
                    if k not in ("label", "sublabel", "status", "errorMessage", "durationMs", "outputVar")
                }
            output_var = n.get("outputVar") or n.get("data", {}).get("outputVar") or f"{node_type}_output"

            norm_nodes.append({
                "id": node_id,
                "type": node_type,
                "name": name,
                "config": config,
                "output_var": output_var,
            })

        norm_edges = []
        for e in edges:
            norm_edges.append({
                "id": e.get("id", str(uuid.uuid4())),
                "source": e.get("source"),
                "target": e.get("target"),
                "sourceHandle": e.get("sourceHandle") or e.get("label"),
                "label": e.get("label"),
            })

        return norm_nodes, norm_edges

    async def execute(self, req: WorkflowExecuteRequest) -> WorkflowExecuteResponse:
        start_time = time.perf_counter()
        execution_id = f"exec_{int(time.time())}_{uuid.uuid4().hex[:6]}"

        nodes, edges = self._normalize_graph(req.workflow)
        if not nodes:
            raise HTTPException(status_code=400, detail="Workflow contains no nodes to execute.")

        node_map = {n["id"]: n for n in nodes}
        out_edges_map: Dict[str, List[Dict[str, Any]]] = {}
        for edge in edges:
            out_edges_map.setdefault(edge["source"], []).append(edge)

        # Locate start node
        start_node = next((n for n in nodes if n["type"] == "start"), None)
        if not start_node:
            # Fallback to first node with no incoming edges or first node
            incoming_targets = {e["target"] for e in edges}
            start_node = next((n for n in nodes if n["id"] not in incoming_targets), nodes[0])

        raw_inputs = dict(req.inputs or {})
        user_msg = (
            raw_inputs.get("user_message")
            or raw_inputs.get("message")
            or raw_inputs.get("input")
            or raw_inputs.get("text")
            or ""
        )
        if isinstance(user_msg, dict):
            user_msg = user_msg.get("user_message") or user_msg.get("message") or user_msg.get("text") or str(user_msg)
        user_msg_str = str(user_msg)

        effective_session_id = req.session_id or req.conversation_id or execution_id
        input_dict = {
            **raw_inputs,
            "user_message": user_msg_str,
            "message": user_msg_str,
            "text": user_msg_str,
            "session_id": effective_session_id,
        }

        state: Dict[str, Any] = {
            "inputs": input_dict,
            "input": input_dict,
            "user_message": user_msg_str,
            "message": user_msg_str,
            "session_id": effective_session_id,
            "execution_id": execution_id,
        }

        # 1. Populate top-level state from input
        for k, v in input_dict.items():
            state[k] = v

        # 2. Resolve conversation history passed directly from API (up to 20 past messages)
        effective_history = list(req.conversation_history) if req.conversation_history else []

        step_traces: List[NodeExecutionTrace] = []
        total_tokens = 0
        current_node_id: Optional[str] = start_node["id"]
        iterations = 0
        max_iterations = 40
        last_generated_text = ""

        logger.info(f"Starting workflow execution [{execution_id}] with {len(nodes)} nodes")

        while current_node_id and iterations < max_iterations:
            iterations += 1
            node = node_map.get(current_node_id)
            if not node:
                break

            node_id = node["id"]
            node_type = node["type"]
            node_name = node["name"]
            node_config = node["config"]
            output_var = node["output_var"]

            node_start = time.perf_counter()
            started_at_str = datetime.datetime.now(datetime.timezone.utc).isoformat()
            node_error: Optional[str] = None
            node_output: Dict[str, Any] = {}
            selected_route: Optional[str] = None
            tool_calls_trace: Optional[List[ToolCallTrace]] = None
            node_tokens = 0

            try:
                # ── 1. START NODE ──────────────────────────────────────────
                if node_type == "start":
                    default_values = node_config.get("defaultValues", {})
                    if isinstance(default_values, dict):
                        for dk, dv in default_values.items():
                            if dk not in state or state[dk] is None:
                                state[dk] = dv
                    node_output = {
                        k: v for k, v in state.items()
                        if k not in ("session_id", "execution_id")
                    }

                # ── 2. CONDITION NODE ──────────────────────────────────────
                elif node_type == "condition":
                    conditions = node_config.get("conditions", [])
                    combine_mode = node_config.get("combineMode", "OR")
                    default_route = node_config.get("defaultRoute", "fallback")
                    matched_route: Optional[str] = None

                    if combine_mode == "AND":
                        all_passed = bool(conditions) and all(
                            evaluate_condition_rule(c, state) for c in conditions
                        )
                        if all_passed and conditions:
                            matched_route = conditions[0].get("targetRouteId")
                    else:  # OR
                        for cond in conditions:
                            if evaluate_condition_rule(cond, state):
                                matched_route = cond.get("targetRouteId")
                                break

                    selected_route = matched_route or default_route
                    state["condition_route"] = selected_route
                    node_output = {"selected_route": selected_route, "combine_mode": combine_mode}

                # ── 3. LLM NODE ───────────────────────────────────────────
                elif node_type == "llm":
                    system_prompt = node_config.get("systemPrompt", "You are an intelligent AI workflow assistant.")
                    user_prompt_template = node_config.get("userPrompt") or "{input.user_message}"
                    interpolated_user = interpolate_template(user_prompt_template, state)
                    # If interpolation left an unexpanded template placeholder or is empty, use the actual user message
                    if not interpolated_user or re.search(r"\{\{?\s*[\w\.\-]+\s*\}?\}", interpolated_user):
                        if state.get("user_message"):
                            interpolated_user = state["user_message"]
                    temperature = float(node_config.get("temperature", 0.7))
                    model_name = node_config.get("model", self.default_model)
                    response_format = node_config.get("responseFormat", "text")

                    messages = [
                        SystemMessage(content=interpolate_template(system_prompt, state)),
                    ]

                    # Include conversation history passed from API (up to 20 past messages)
                    if effective_history:
                        for prev_msg in effective_history[-20:]:
                            role = (prev_msg.get("role") or "user").lower()
                            content = prev_msg.get("content") or ""
                            if isinstance(content, dict):
                                content = content.get("text") or content.get("message") or json.dumps(content)
                            if role == "user":
                                messages.append(HumanMessage(content=str(content)))
                            elif role in ("assistant", "ai", "model"):
                                messages.append(AIMessage(content=str(content)))

                    messages.append(HumanMessage(content=interpolated_user))

                    ai_resp, used_model = await self._invoke_llm_with_fallback(
                        messages,
                        model_name=model_name,
                        temperature=temperature,
                    )
                    generated_text = extract_text_from_ai_content(ai_resp.content)

                    # Token accounting estimation
                    prompt_toks = len(interpolated_user) // 4 + 40
                    compl_toks = len(generated_text) // 4
                    node_tokens = prompt_toks + compl_toks
                    total_tokens += node_tokens

                    parsed_json = None
                    if response_format == "json_object":
                        try:
                            # Clean code fence if present
                            clean_json = generated_text
                            if clean_json.startswith("```"):
                                clean_json = re.sub(r"^```(?:json)?\s*|\s*```$", "", clean_json, flags=re.MULTILINE).strip()
                            parsed_json = json.loads(clean_json)
                        except Exception:
                            parsed_json = {"raw_text": generated_text}

                    node_output = {
                        "text": generated_text,
                        "json": parsed_json,
                        "model": used_model,
                    }
                    state["llm_output"] = generated_text
                    state["agent_output"] = generated_text
                    state["response"] = generated_text
                    state["output"] = generated_text
                    state[output_var] = generated_text
                    if parsed_json:
                        state[f"{output_var}_json"] = parsed_json
                    last_generated_text = generated_text

                # ── 4. AGENT NODE (Autonomous Tool-Calling Agent) ──────────
                elif node_type == "agent":
                    instructions = (
                        node_config.get("instructions")
                        or node_config.get("systemPrompt")
                        or "You are an autonomous AI problem-solving agent. Analyze the user request, use tools if needed, and give a comprehensive answer."
                    )
                    interpolated_instructions = interpolate_template(instructions, state)
                    available_tools = node_config.get("availableTools") or node_config.get("tools") or ["web_search", "calculator", "datetime"]
                    max_iterations = min(int(node_config.get("maxIterations", 5)), 6)
                    model_name = node_config.get("model", self.default_model)
                    temperature = float(node_config.get("temperature", 0.5))

                    raw_user_msg = state.get("user_message") or state.get("input") or "Hello"
                    if isinstance(raw_user_msg, dict):
                        user_msg = raw_user_msg.get("user_message") or raw_user_msg.get("message") or raw_user_msg.get("input") or str(raw_user_msg)
                    else:
                        user_msg = str(raw_user_msg)

                    # We run an autonomous tool loop
                    tool_calls_trace = []
                    current_loop = 0
                    agent_context_text = f"USER QUERY: {user_msg}\n"

                    # Pre-fetch or tool calling logic:
                    # If web_search is enabled and query asks about real-time info, trigger tool
                    if "datetime" in available_tools:
                        dt_info = get_current_datetime()
                        agent_context_text += f"\n[Tool Observation datetime]: {json.dumps(dt_info)}"

                    if "web_search" in available_tools:
                        tool_start = time.perf_counter()
                        search_res = await live_web_search(user_msg, max_results=3)
                        tool_duration = (time.perf_counter() - tool_start) * 1000
                        tool_calls_trace.append(ToolCallTrace(
                            id=f"tool_search_{int(time.time())}",
                            tool_name="web_search",
                            arguments={"query": user_msg},
                            result=search_res,
                            duration_ms=round(tool_duration, 2),
                            status="success"
                        ))
                        agent_context_text += f"\n[Tool Observation web_search]: {json.dumps(search_res)}"

                    if "calculator" in available_tools:
                        # Extract potential math expressions like "what is 45 * 12"
                        math_match = re.search(r"(\d+[\d\s\+\-\*\/\^\.\(\)]+[\d\)])", user_msg)
                        if math_match:
                            expr = math_match.group(1).strip()
                            tool_start = time.perf_counter()
                            calc_res = safe_calculator(expr)
                            tool_duration = (time.perf_counter() - tool_start) * 1000
                            tool_calls_trace.append(ToolCallTrace(
                                id=f"tool_calc_{int(time.time())}",
                                tool_name="calculator",
                                arguments={"expression": expr},
                                result=calc_res,
                                duration_ms=round(tool_duration, 2),
                                status="success"
                            ))
                            agent_context_text += f"\n[Tool Observation calculator for '{expr}']: {calc_res}"

                    # Final reasoning synthesis with Gemini
                    system_msg = (
                        f"{interpolated_instructions}\n"
                        f"Tools available and observations gathered:\n"
                        f"{agent_context_text}\n"
                        f"Provide a direct, helpful, and natural response to the user based on the instructions and observations."
                    )
                    messages = [
                        SystemMessage(content=system_msg),
                    ]
                    if effective_history:
                        for prev_msg in effective_history[-20:]:
                            role = (prev_msg.get("role") or "user").lower()
                            content = prev_msg.get("content") or ""
                            if isinstance(content, dict):
                                content = content.get("text") or content.get("message") or json.dumps(content)
                            if role == "user":
                                messages.append(HumanMessage(content=str(content)))
                            elif role in ("assistant", "ai", "model"):
                                messages.append(AIMessage(content=str(content)))
                    messages.append(HumanMessage(content=user_msg))
                    ai_resp, used_agent_model = await self._invoke_llm_with_fallback(
                        messages,
                        model_name=model_name,
                        temperature=temperature,
                    )
                    agent_answer = extract_text_from_ai_content(ai_resp.content)

                    node_output = {
                        "result": agent_answer,
                        "tools_used": [t.tool_name for t in tool_calls_trace],
                        "iterations": len(tool_calls_trace),
                        "model": used_agent_model,
                    }
                    state["agent_output"] = agent_answer
                    state["llm_output"] = agent_answer
                    state["response"] = agent_answer
                    state["output"] = agent_answer
                    state[output_var] = agent_answer
                    last_generated_text = agent_answer

                # ── 5. HTTP REQUEST NODE ──────────────────────────────────
                elif node_type == "http_request":
                    import httpx
                    raw_url = node_config.get("url", "")
                    url = interpolate_template(raw_url, state)
                    method = node_config.get("method", "GET").upper()
                    target_key = node_config.get("responseMapping", {}).get("targetStateKey", "http_response")

                    headers = {}
                    for h in node_config.get("headers", []):
                        if h.get("key"):
                            headers[h["key"]] = interpolate_template(h.get("value", ""), state)

                    async with httpx.AsyncClient(timeout=10.0) as client:
                        resp = await client.request(method, url, headers=headers)
                        try:
                            body_json = resp.json()
                        except Exception:
                            body_json = resp.text

                        node_output = {
                            "status_code": resp.status_code,
                            "data": body_json,
                            "url": url,
                        }
                        state[target_key] = body_json

                # ── 6. TRANSFORM NODE ─────────────────────────────────────
                elif node_type == "transform":
                    assignments = node_config.get("assignments", [])
                    transformed_data = {}
                    for assign in assignments:
                        target_key = assign.get("targetKey")
                        if not target_key:
                            continue
                        if assign.get("constantValue") is not None and assign.get("constantValue") != "":
                            val = assign.get("constantValue")
                        else:
                            source = assign.get("sourceMapping", "")
                            val = state.get(source)
                            if val is None and isinstance(state.get("input"), dict):
                                val = state["input"].get(source)

                        transformed_data[target_key] = val
                        state[target_key] = val

                    output_mapping = node_config.get("outputMapping", output_var)
                    state[output_mapping] = transformed_data
                    node_output = transformed_data

                # ── 7. STRUCTURED OUTPUT NODE ─────────────────────────────
                elif node_type == "structured_output":
                    output_schema = node_config.get("outputSchema", "{}")
                    instructions = node_config.get("instructions", "Format input into structured JSON.")
                    source_text = last_generated_text or state.get("user_message", "")

                    prompt = (
                        f"Instructions: {instructions}\n"
                        f"Produce ONLY valid JSON conforming to this schema:\n{output_schema}\n"
                        f"Source text: {source_text}"
                    )
                    ai_resp, _ = await self._invoke_llm_with_fallback(
                        [HumanMessage(content=prompt)],
                        temperature=0.1,
                    )
                    raw_out = str(ai_resp.content).strip()
                    if raw_out.startswith("```"):
                        raw_out = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw_out, flags=re.MULTILINE).strip()

                    try:
                        structured_json = json.loads(raw_out)
                    except Exception:
                        structured_json = {"raw": raw_out}

                    state["structured_output"] = structured_json
                    state[output_var] = structured_json
                    node_output = structured_json

                # ── 8. END NODE ───────────────────────────────────────────
                elif node_type == "end":
                    mappings = node_config.get("outputMappings", [])
                    final_result = {}
                    if mappings:
                        for m in mappings:
                            s_field = m.get("stateField", "")
                            o_key = m.get("outputKey", s_field)
                            val = state.get(s_field)
                            if val is None and s_field in ("agent_output", "llm_output", "response", "output"):
                                val = state.get("agent_output") or state.get("llm_output") or state.get("response") or last_generated_text
                            final_result[o_key] = val
                    else:
                        final_result = {
                            "response": state.get("agent_output") or state.get("llm_output") or last_generated_text or "Workflow execution finished."
                        }

                    response_template = node_config.get("responseTemplate")
                    if response_template:
                        interpolated = interpolate_template(response_template, state)
                        # Check if interpolation still looks like an unexpanded template e.g. {{agent_output}}
                        if re.match(r"^\{\{?\s*[\w\.\-]+\s*\}?\}$", interpolated.strip()):
                            interpolated = state.get("agent_output") or state.get("llm_output") or last_generated_text or interpolated
                        final_result["formatted_text"] = interpolated
                        final_result["response"] = interpolated

                    node_output = final_result
                    state["final_output"] = final_result

            except Exception as e:
                logger.error(f"Error executing node {node_id} ({node_name}): {e}", exc_info=True)
                node_error = str(e)

            duration_ms = (time.perf_counter() - node_start) * 1000
            finished_at_str = datetime.datetime.now(datetime.timezone.utc).isoformat()

            step_trace = NodeExecutionTrace(
                node_id=node_id,
                node_name=node_name,
                node_type=node_type,
                status="failed" if node_error else "success",
                input_data={"input": state.get("input", {})},
                output_data=node_output,
                selected_route=selected_route,
                tool_calls=tool_calls_trace,
                duration_ms=round(duration_ms, 2),
                error=node_error,
                started_at=started_at_str,
                finished_at=finished_at_str,
            )
            step_traces.append(step_trace)

            if node_error:
                break

            # If this is the end node, terminate
            if node_type == "end":
                break

            # ── ROUTE TO NEXT NODE ──────────────────────────────────────
            out_edges = out_edges_map.get(node_id, [])
            if not out_edges:
                break

            if node_type == "condition" and selected_route:
                matched_edge = next(
                    (
                        e for e in out_edges
                        if e.get("sourceHandle") == selected_route
                        or str(e.get("label", "")).lower() == selected_route.lower()
                    ),
                    None
                )
                if not matched_edge:
                    matched_edge = next(
                        (e for e in out_edges if e.get("sourceHandle") in ("default", "fallback")),
                        out_edges[0]
                    )
                current_node_id = matched_edge.get("target")
            else:
                current_node_id = out_edges[0].get("target")

        # Determine primary user-facing response text
        final_response_text = ""
        if isinstance(state.get("final_output"), dict):
            final_response_text = (
                state["final_output"].get("formatted_text")
                or state["final_output"].get("response")
                or state["final_output"].get("response_message")
                or state["final_output"].get("message")
                or state["final_output"].get("text")
            )
        # If still empty or an unexpanded template string like {{agent_output}}, fallback to model text
        if not final_response_text or re.match(r"^\{\{?\s*[\w\.\-]+\s*\}?\}$", str(final_response_text).strip()):
            final_response_text = (
                state.get("agent_output")
                or state.get("llm_output")
                or last_generated_text
                or "Workflow execution finished."
            )

        total_duration = (time.perf_counter() - start_time) * 1000
        has_failed = any(t.status == "failed" for t in step_traces)

        return WorkflowExecuteResponse(
            execution_id=execution_id,
            status="failed" if has_failed else "completed",
            response_text=final_response_text,
            outputs=state.get("final_output") or {"response": final_response_text},
            state=state,
            step_traces=step_traces,
            total_duration_ms=round(total_duration, 2),
            total_tokens=total_tokens,
        )

    async def execute_stream(self, req: WorkflowExecuteRequest) -> AsyncGenerator[str, None]:
        """
        Executes a workflow graph step-by-step and streams real-time SSE events:
        - node_start: emitted when each node starts
        - token: emitted for LLM and agent token generations
        - tool_call: emitted during autonomous tool execution
        - node_end: emitted when each node completes
        - done: emitted at final completion with full checkpoint payload
        - error: emitted if a fatal error occurs
        """
        start_time = time.perf_counter()
        execution_id = f"exec_{int(time.time())}_{uuid.uuid4().hex[:6]}"

        try:
            nodes, edges = self._normalize_graph(req.workflow)
            if not nodes:
                yield f"data: {json.dumps({'type': 'error', 'error': 'Workflow contains no nodes to execute.'})}\n\n"
                return

            node_map = {n["id"]: n for n in nodes}
            out_edges_map: Dict[str, List[Dict[str, Any]]] = {}
            for edge in edges:
                out_edges_map.setdefault(edge["source"], []).append(edge)

            # Locate start node
            start_node = next((n for n in nodes if n["type"] == "start"), None)
            if not start_node:
                incoming_targets = {e["target"] for e in edges}
                start_node = next((n for n in nodes if n["id"] not in incoming_targets), nodes[0])

            raw_inputs = dict(req.inputs or {})
            user_msg = (
                raw_inputs.get("user_message")
                or raw_inputs.get("message")
                or raw_inputs.get("input")
                or raw_inputs.get("text")
                or ""
            )
            if isinstance(user_msg, dict):
                user_msg = user_msg.get("user_message") or user_msg.get("message") or user_msg.get("text") or str(user_msg)
            user_msg_str = str(user_msg)

            effective_session_id = req.session_id or req.conversation_id or execution_id
            input_dict = {
                **raw_inputs,
                "user_message": user_msg_str,
                "message": user_msg_str,
                "text": user_msg_str,
                "session_id": effective_session_id,
            }

            state: Dict[str, Any] = {
                "inputs": input_dict,
                "input": input_dict,
                "user_message": user_msg_str,
                "message": user_msg_str,
                "session_id": effective_session_id,
                "execution_id": execution_id,
            }

            # 1. Populate top-level state from input
            for k, v in input_dict.items():
                state[k] = v

            # 2. Resolve conversation history passed directly from API (up to 20 past messages)
            effective_history = list(req.conversation_history) if req.conversation_history else []

            step_traces: List[NodeExecutionTrace] = []
            total_tokens = 0
            current_node_id: Optional[str] = start_node["id"]
            iterations = 0
            max_iterations = 40
            last_generated_text = ""

            logger.info(f"Starting streaming workflow execution [{execution_id}] with {len(nodes)} nodes")

            while current_node_id and iterations < max_iterations:
                iterations += 1
                node = node_map.get(current_node_id)
                if not node:
                    break

                node_id = node["id"]
                node_type = node["type"]
                node_name = node["name"]
                node_config = node["config"]
                output_var = node["output_var"]

                # Emit node start event
                yield f"data: {json.dumps({'type': 'node_start', 'node_id': node_id, 'node_name': node_name, 'node_type': node_type})}\n\n"

                node_start = time.perf_counter()
                started_at_str = datetime.datetime.now(datetime.timezone.utc).isoformat()
                node_error: Optional[str] = None
                node_output: Dict[str, Any] = {}
                selected_route: Optional[str] = None
                tool_calls_trace: Optional[List[ToolCallTrace]] = None
                node_tokens = 0

                try:
                    # ── 1. START NODE ──────────────────────────────────────
                    if node_type == "start":
                        default_values = node_config.get("defaultValues", {})
                        if isinstance(default_values, dict):
                            for dk, dv in default_values.items():
                                if dk not in state or state[dk] is None:
                                    state[dk] = dv
                        node_output = {
                            k: v for k, v in state.items()
                            if k not in ("session_id", "execution_id")
                        }

                    # ── 2. CONDITION NODE ──────────────────────────────────
                    elif node_type == "condition":
                        conditions = node_config.get("conditions", [])
                        combine_mode = node_config.get("combineMode", "OR")
                        default_route = node_config.get("defaultRoute", "fallback")
                        matched_route: Optional[str] = None

                        if combine_mode == "AND":
                            all_passed = bool(conditions) and all(
                                evaluate_condition_rule(c, state) for c in conditions
                            )
                            if all_passed and conditions:
                                matched_route = conditions[0].get("targetRouteId")
                        else:  # OR
                            for cond in conditions:
                                if evaluate_condition_rule(cond, state):
                                    matched_route = cond.get("targetRouteId")
                                    break

                        selected_route = matched_route or default_route
                        state["condition_route"] = selected_route
                        node_output = {"selected_route": selected_route, "combine_mode": combine_mode}

                    # ── 3. LLM NODE (STREAMED) ─────────────────────────────
                    elif node_type == "llm":
                        system_prompt = node_config.get("systemPrompt", "You are an intelligent AI workflow assistant.")
                        user_prompt_template = node_config.get("userPrompt") or "{input.user_message}"
                        interpolated_user = interpolate_template(user_prompt_template, state)
                        if not interpolated_user or re.search(r"\{\{?\s*[\w\.\-]+\s*\}?\}", interpolated_user):
                            if state.get("user_message"):
                                interpolated_user = state["user_message"]
                        temperature = float(node_config.get("temperature", 0.7))
                        model_name = node_config.get("model", self.default_model)
                        response_format = node_config.get("responseFormat", "text")

                        messages = [
                            SystemMessage(content=interpolate_template(system_prompt, state)),
                        ]

                        # Include conversation history (up to 20 past messages)
                        if effective_history:
                            for prev_msg in effective_history[-20:]:
                                role = (prev_msg.get("role") or "user").lower()
                                content = prev_msg.get("content") or ""
                                if isinstance(content, dict):
                                    content = content.get("text") or content.get("message") or json.dumps(content)
                                if role == "user":
                                    messages.append(HumanMessage(content=str(content)))
                                elif role in ("assistant", "ai", "model"):
                                    messages.append(AIMessage(content=str(content)))

                        messages.append(HumanMessage(content=interpolated_user))

                        full_chunks: List[str] = []
                        used_model = model_name or self.default_model

                        try:
                            async for chunk, m_name in self._astream_llm_with_fallback(
                                messages,
                                model_name=model_name,
                                temperature=temperature,
                            ):
                                used_model = m_name
                                token_text = extract_text_from_chunk(chunk.content)
                                if token_text:
                                    full_chunks.append(token_text)
                                    yield f"data: {json.dumps({'type': 'token', 'content': token_text})}\n\n"
                            generated_text = "".join(full_chunks)
                        except Exception as stream_err:
                            logger.warning(f"Streaming failed for LLM node {node_id}: {stream_err}. Using fallback invocation.")
                            ai_resp, used_model = await self._invoke_llm_with_fallback(
                                messages,
                                model_name=model_name,
                                temperature=temperature,
                            )
                            generated_text = extract_text_from_ai_content(ai_resp.content)
                            yield f"data: {json.dumps({'type': 'token', 'content': generated_text})}\n\n"

                        # Token accounting estimation
                        prompt_toks = len(interpolated_user) // 4 + 40
                        compl_toks = len(generated_text) // 4
                        node_tokens = prompt_toks + compl_toks
                        total_tokens += node_tokens

                        parsed_json = None
                        if response_format == "json_object":
                            try:
                                clean_json = generated_text
                                if clean_json.startswith("```"):
                                    clean_json = re.sub(r"^```(?:json)?\s*|\s*```$", "", clean_json, flags=re.MULTILINE).strip()
                                parsed_json = json.loads(clean_json)
                            except Exception:
                                parsed_json = {"raw_text": generated_text}

                        node_output = {
                            "text": generated_text,
                            "json": parsed_json,
                            "model": used_model,
                        }
                        state["llm_output"] = generated_text
                        state["agent_output"] = generated_text
                        state["response"] = generated_text
                        state["output"] = generated_text
                        state[output_var] = generated_text
                        if parsed_json:
                            state[f"{output_var}_json"] = parsed_json
                        last_generated_text = generated_text

                    # ── 4. AGENT NODE (STREAMED SYNTHESIS) ─────────────────
                    elif node_type == "agent":
                        instructions = (
                            node_config.get("instructions")
                            or node_config.get("systemPrompt")
                            or "You are an autonomous AI problem-solving agent. Analyze the user request, use tools if needed, and give a comprehensive answer."
                        )
                        interpolated_instructions = interpolate_template(instructions, state)
                        available_tools = node_config.get("availableTools") or node_config.get("tools") or ["web_search", "calculator", "datetime"]
                        model_name = node_config.get("model", self.default_model)
                        temperature = float(node_config.get("temperature", 0.5))

                        raw_user_msg = state.get("user_message") or state.get("input") or "Hello"
                        if isinstance(raw_user_msg, dict):
                            user_msg = raw_user_msg.get("user_message") or raw_user_msg.get("message") or raw_user_msg.get("input") or str(raw_user_msg)
                        else:
                            user_msg = str(raw_user_msg)

                        tool_calls_trace = []
                        agent_context_text = f"USER QUERY: {user_msg}\n"

                        if "datetime" in available_tools:
                            dt_info = get_current_datetime()
                            agent_context_text += f"\n[Tool Observation datetime]: {json.dumps(dt_info)}"

                        if "web_search" in available_tools:
                            yield f"data: {json.dumps({'type': 'tool_call', 'tool_name': 'web_search', 'status': 'running'})}\n\n"
                            tool_start = time.perf_counter()
                            search_res = await live_web_search(user_msg, max_results=3)
                            tool_duration = (time.perf_counter() - tool_start) * 1000
                            tool_calls_trace.append(ToolCallTrace(
                                id=f"tool_search_{int(time.time())}",
                                tool_name="web_search",
                                arguments={"query": user_msg},
                                result=search_res,
                                duration_ms=round(tool_duration, 2),
                                status="success"
                            ))
                            agent_context_text += f"\n[Tool Observation web_search]: {json.dumps(search_res)}"
                            yield f"data: {json.dumps({'type': 'tool_call', 'tool_name': 'web_search', 'status': 'completed', 'duration_ms': round(tool_duration, 2)})}\n\n"

                        if "calculator" in available_tools:
                            math_match = re.search(r"(\d+[\d\s\+\-\*\/\^\.\(\)]+[\d\)])", user_msg)
                            if math_match:
                                expr = math_match.group(1).strip()
                                yield f"data: {json.dumps({'type': 'tool_call', 'tool_name': 'calculator', 'status': 'running', 'expression': expr})}\n\n"
                                tool_start = time.perf_counter()
                                calc_res = safe_calculator(expr)
                                tool_duration = (time.perf_counter() - tool_start) * 1000
                                tool_calls_trace.append(ToolCallTrace(
                                    id=f"tool_calc_{int(time.time())}",
                                    tool_name="calculator",
                                    arguments={"expression": expr},
                                    result=calc_res,
                                    duration_ms=round(tool_duration, 2),
                                    status="success"
                                ))
                                agent_context_text += f"\n[Tool Observation calculator for '{expr}']: {calc_res}"
                                yield f"data: {json.dumps({'type': 'tool_call', 'tool_name': 'calculator', 'status': 'completed', 'duration_ms': round(tool_duration, 2)})}\n\n"

                        # Stream the final synthesis response
                        system_msg = (
                            f"{interpolated_instructions}\n"
                            f"Tools available and observations gathered:\n"
                            f"{agent_context_text}\n"
                            f"Provide a direct, helpful, and natural response to the user based on the instructions and observations."
                        )
                        messages = [SystemMessage(content=system_msg)]
                        if effective_history:
                            for prev_msg in effective_history[-20:]:
                                role = (prev_msg.get("role") or "user").lower()
                                content = prev_msg.get("content") or ""
                                if isinstance(content, dict):
                                    content = content.get("text") or content.get("message") or json.dumps(content)
                                if role == "user":
                                    messages.append(HumanMessage(content=str(content)))
                                elif role in ("assistant", "ai", "model"):
                                    messages.append(AIMessage(content=str(content)))
                        messages.append(HumanMessage(content=user_msg))

                        full_agent_chunks: List[str] = []
                        used_agent_model = model_name or self.default_model

                        try:
                            async for chunk, m_name in self._astream_llm_with_fallback(
                                messages,
                                model_name=model_name,
                                temperature=temperature,
                            ):
                                used_agent_model = m_name
                                token_text = extract_text_from_chunk(chunk.content)
                                if token_text:
                                    full_agent_chunks.append(token_text)
                                    yield f"data: {json.dumps({'type': 'token', 'content': token_text})}\n\n"
                            agent_answer = "".join(full_agent_chunks)
                        except Exception as stream_err:
                            logger.warning(f"Streaming failed for agent node {node_id}: {stream_err}. Using fallback invocation.")
                            ai_resp, used_agent_model = await self._invoke_llm_with_fallback(
                                messages,
                                model_name=model_name,
                                temperature=temperature,
                            )
                            agent_answer = extract_text_from_ai_content(ai_resp.content)
                            yield f"data: {json.dumps({'type': 'token', 'content': agent_answer})}\n\n"

                        node_output = {
                            "result": agent_answer,
                            "tools_used": [t.tool_name for t in tool_calls_trace],
                            "iterations": len(tool_calls_trace),
                            "model": used_agent_model,
                        }
                        state["agent_output"] = agent_answer
                        state["llm_output"] = agent_answer
                        state["response"] = agent_answer
                        state["output"] = agent_answer
                        state[output_var] = agent_answer
                        last_generated_text = agent_answer

                    # ── 5. HTTP REQUEST NODE ──────────────────────────────
                    elif node_type == "http_request":
                        import httpx
                        raw_url = node_config.get("url", "")
                        url = interpolate_template(raw_url, state)
                        method = node_config.get("method", "GET").upper()
                        target_key = node_config.get("responseMapping", {}).get("targetStateKey", "http_response")

                        headers = {}
                        for h in node_config.get("headers", []):
                            if h.get("key"):
                                headers[h["key"]] = interpolate_template(h.get("value", ""), state)

                        async with httpx.AsyncClient(timeout=10.0) as client:
                            resp = await client.request(method, url, headers=headers)
                            try:
                                body_json = resp.json()
                            except Exception:
                                body_json = resp.text

                            node_output = {
                                "status_code": resp.status_code,
                                "data": body_json,
                                "url": url,
                            }
                            state[target_key] = body_json

                    # ── 6. TRANSFORM NODE ─────────────────────────────────
                    elif node_type == "transform":
                        assignments = node_config.get("assignments", [])
                        transformed_data = {}
                        for assign in assignments:
                            target_key = assign.get("targetKey")
                            if not target_key:
                                continue
                            if assign.get("constantValue") is not None and assign.get("constantValue") != "":
                                val = assign.get("constantValue")
                            else:
                                source = assign.get("sourceMapping", "")
                                val = state.get(source)
                                if val is None and isinstance(state.get("input"), dict):
                                    val = state["input"].get(source)

                            transformed_data[target_key] = val
                            state[target_key] = val

                        output_mapping = node_config.get("outputMapping", output_var)
                        state[output_mapping] = transformed_data
                        node_output = transformed_data

                    # ── 7. STRUCTURED OUTPUT NODE ─────────────────────────
                    elif node_type == "structured_output":
                        output_schema = node_config.get("outputSchema", "{}")
                        instructions = node_config.get("instructions", "Format input into structured JSON.")
                        source_text = last_generated_text or state.get("user_message", "")

                        prompt = (
                            f"Instructions: {instructions}\n"
                            f"Produce ONLY valid JSON conforming to this schema:\n{output_schema}\n"
                            f"Source text: {source_text}"
                        )
                        ai_resp, _ = await self._invoke_llm_with_fallback(
                            [HumanMessage(content=prompt)],
                            temperature=0.1,
                        )
                        raw_out = str(ai_resp.content).strip()
                        if raw_out.startswith("```"):
                            raw_out = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw_out, flags=re.MULTILINE).strip()

                        try:
                            structured_json = json.loads(raw_out)
                        except Exception:
                            structured_json = {"raw": raw_out}

                        state["structured_output"] = structured_json
                        state[output_var] = structured_json
                        node_output = structured_json

                    # ── 8. END NODE ───────────────────────────────────────
                    elif node_type == "end":
                        mappings = node_config.get("outputMappings", [])
                        final_result = {}
                        if mappings:
                            for m in mappings:
                                s_field = m.get("stateField", "")
                                o_key = m.get("outputKey", s_field)
                                val = state.get(s_field)
                                if val is None and s_field in ("agent_output", "llm_output", "response", "output"):
                                    val = state.get("agent_output") or state.get("llm_output") or state.get("response") or last_generated_text
                                final_result[o_key] = val
                        else:
                            final_result = {
                                "response": state.get("agent_output") or state.get("llm_output") or last_generated_text or "Workflow execution finished."
                            }

                        response_template = node_config.get("responseTemplate")
                        if response_template:
                            interpolated = interpolate_template(response_template, state)
                            if re.match(r"^\{\{?\s*[\w\.\-]+\s*\}?\}$", interpolated.strip()):
                                interpolated = state.get("agent_output") or state.get("llm_output") or last_generated_text or interpolated
                            final_result["formatted_text"] = interpolated
                            final_result["response"] = interpolated

                        node_output = final_result
                        state["final_output"] = final_result

                except Exception as e:
                    logger.error(f"Error executing streaming node {node_id} ({node_name}): {e}", exc_info=True)
                    node_error = str(e)

                duration_ms = (time.perf_counter() - node_start) * 1000
                finished_at_str = datetime.datetime.now(datetime.timezone.utc).isoformat()

                step_trace = NodeExecutionTrace(
                    node_id=node_id,
                    node_name=node_name,
                    node_type=node_type,
                    status="failed" if node_error else "success",
                    input_data={"input": state.get("input", {})},
                    output_data=node_output,
                    selected_route=selected_route,
                    tool_calls=tool_calls_trace,
                    duration_ms=round(duration_ms, 2),
                    error=node_error,
                    started_at=started_at_str,
                    finished_at=finished_at_str,
                )
                step_traces.append(step_trace)

                # Emit node completion event
                yield f"data: {json.dumps({'type': 'node_end', 'node_id': node_id, 'node_name': node_name, 'status': 'failed' if node_error else 'success', 'duration_ms': round(duration_ms, 2)})}\n\n"

                if node_error:
                    break

                if node_type == "end":
                    break

                # ── ROUTE TO NEXT NODE ──────────────────────────────────
                out_edges = out_edges_map.get(node_id, [])
                if not out_edges:
                    break

                if node_type == "condition" and selected_route:
                    matched_edge = next(
                        (
                            e for e in out_edges
                            if e.get("sourceHandle") == selected_route
                            or str(e.get("label", "")).lower() == selected_route.lower()
                        ),
                        None
                    )
                    if not matched_edge:
                        matched_edge = next(
                            (e for e in out_edges if e.get("sourceHandle") in ("default", "fallback")),
                            out_edges[0]
                        )
                    current_node_id = matched_edge.get("target")
                else:
                    current_node_id = out_edges[0].get("target")

            # Determine primary user-facing response text
            final_response_text = ""
            if isinstance(state.get("final_output"), dict):
                final_response_text = (
                    state["final_output"].get("formatted_text")
                    or state["final_output"].get("response")
                    or state["final_output"].get("response_message")
                    or state["final_output"].get("message")
                    or state["final_output"].get("text")
                )
            if not final_response_text or re.match(r"^\{\{?\s*[\w\.\-]+\s*\}?\}$", str(final_response_text).strip()):
                final_response_text = (
                    state.get("agent_output")
                    or state.get("llm_output")
                    or last_generated_text
                    or "Workflow execution finished."
                )

            total_duration = (time.perf_counter() - start_time) * 1000
            has_failed = any(t.status == "failed" for t in step_traces)

            done_payload = {
                "type": "done",
                "execution_id": execution_id,
                "status": "failed" if has_failed else "completed",
                "response_text": final_response_text,
                "outputs": state.get("final_output") or {"response": final_response_text},
                "state": state,
                "step_traces": [t.model_dump() for t in step_traces],
                "total_duration_ms": round(total_duration, 2),
                "total_tokens": total_tokens,
            }
            yield f"data: {json.dumps(done_payload)}\n\n"

        except Exception as outer_err:
            logger.error(f"Fatal error during workflow stream execution: {outer_err}", exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'error': str(outer_err)})}\n\n"

