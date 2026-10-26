import type {
  WorkflowGraph,
  WorkflowExecutionTrace,
  NodeExecutionTrace,
  ToolCallTrace,
  CoreNodeType,
} from '../../types/workflow';

export interface ExecutionOptions {
  inputs: Record<string, any>;
  onNodeStart?: (nodeId: string) => void;
  onNodeFinish?: (nodeId: string, trace: NodeExecutionTrace) => void;
  mockDelayMs?: number;
}

/**
 * Helper to interpolate variable templates like "{input.user_message}" or "{state.answer}"
 */
export function interpolateTemplate(template: string, state: Record<string, any>): string {
  if (!template) return '';
  return template.replace(/\{([\w.]+)\}/g, (_, key) => {
    const parts = key.split('.');
    let val: any = state;
    for (const part of parts) {
      if (val === undefined || val === null) break;
      val = val[part];
    }
    if (val !== undefined && val !== null) {
      return typeof val === 'object' ? JSON.stringify(val) : String(val);
    }
    // Check top-level input fallback
    if (state.input && state.input[key] !== undefined) {
      const v = state.input[key];
      return typeof v === 'object' ? JSON.stringify(v) : String(v);
    }
    return `{${key}}`;
  });
}

/**
 * Evaluates a single condition rule against the current state
 */
function evaluateConditionRule(
  rule: {
    sourceField: string;
    operator: string;
    comparisonValue: string;
    targetRouteId: string;
  },
  state: Record<string, any>,
): boolean {
  // Resolve field value from state or state.input
  let fieldVal = state[rule.sourceField];
  if (fieldVal === undefined && state.input) {
    fieldVal = state.input[rule.sourceField];
  }
  const strVal = String(fieldVal ?? '').toLowerCase();
  const compVal = String(rule.comparisonValue ?? '').toLowerCase();

  switch (rule.operator) {
    case 'equals':
      return strVal === compVal;
    case 'not_equals':
      return strVal !== compVal;
    case 'contains': {
      const keywords = compVal.split(',').map((k) => k.trim());
      return keywords.some((k) => k && strVal.includes(k));
    }
    case 'not_contains':
      return !strVal.includes(compVal);
    case 'exists':
      return fieldVal !== undefined && fieldVal !== null && fieldVal !== '';
    case 'not_exists':
      return fieldVal === undefined || fieldVal === null || fieldVal === '';
    case 'greater_than':
      return Number(fieldVal) > Number(rule.comparisonValue);
    case 'less_than':
      return Number(fieldVal) < Number(rule.comparisonValue);
    default:
      return false;
  }
}

/**
 * Client-Side Workflow Execution Runtime Engine.
 * Executes the workflow step-by-step, respects conditional branching,
 * simulates AI models & tools, and generates an audit trace.
 */
export async function executeWorkflow(
  graph: WorkflowGraph,
  options: ExecutionOptions,
): Promise<WorkflowExecutionTrace> {
  const executionId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const startedAt = new Date().toISOString();
  const stepTraces: NodeExecutionTrace[] = [];

  const state: Record<string, any> = {
    input: { ...(options.inputs || {}) },
    system: {
      execution_id: executionId,
      started_at: startedAt,
      model_budget_used: 0,
    },
  };

  let totalTokens = 0;
  const mockDelay = options.mockDelayMs ?? 250;

  // 1. Locate Start Node
  const startNode = graph.nodes.find((n) => n.type === 'start');
  if (!startNode) {
    throw new Error('Execution failed: Missing Start Trigger node.');
  }

  // Helper: map edges by source
  const outEdgesMap = new Map<string, typeof graph.edges>();
  graph.edges.forEach((edge) => {
    const list = outEdgesMap.get(edge.source) || [];
    list.push(edge);
    outEdgesMap.set(edge.source, list);
  });

  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  let currentNodeId: string | null = startNode.id;
  let iterations = 0;
  const maxIterations = 50;

  while (currentNodeId && iterations < maxIterations) {
    iterations++;
    const node = nodeMap.get(currentNodeId);
    if (!node) break;

    const nodeConfig = node.data?.config || {};
    const nodeType: CoreNodeType = node.type;
    const nodeStart = Date.now();

    options.onNodeStart?.(node.id);
    if (mockDelay > 0) {
      await new Promise((res) => setTimeout(res, mockDelay));
    }

    let nodeOutput: Record<string, any> = {};
    let selectedRoute: string | undefined = undefined;
    let toolCalls: ToolCallTrace[] | undefined = undefined;
    let nodeTokens = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    let nodeError: string | undefined = undefined;

    try {
      switch (nodeType) {
        case 'start': {
          // Initialize state with inputs and default values
          const defaults = nodeConfig.defaultValues || {};
          state.input = { ...defaults, ...state.input };
          nodeOutput = { ...state.input };
          break;
        }

        case 'condition': {
          const conditions = nodeConfig.conditions || [];
          const combineMode = nodeConfig.combineMode || 'OR';
          const defaultRoute = nodeConfig.defaultRoute || 'fallback';

          let matchedRouteId: string | null = null;

          if (combineMode === 'OR') {
            for (const cond of conditions) {
              if (evaluateConditionRule(cond, state)) {
                matchedRouteId = cond.targetRouteId;
                break;
              }
            }
          } else {
            // AND mode
            const allMatched = conditions.every((cond: any) =>
              evaluateConditionRule(cond, state),
            );
            if (allMatched && conditions.length > 0) {
              matchedRouteId = conditions[0].targetRouteId;
            }
          }

          selectedRoute = matchedRouteId || defaultRoute;
          state.condition_route = selectedRoute;
          nodeOutput = { selectedRoute, mode: combineMode };
          break;
        }

        case 'llm': {
          const userPrompt = interpolateTemplate(nodeConfig.userPrompt || '', state);
          const systemPrompt = nodeConfig.systemPrompt || 'Assistant';
          const model = nodeConfig.model || 'gpt-4o-mini';

          // Simulate token metrics
          const promptTokens = Math.max(15, Math.round(userPrompt.length / 3));
          const completionTokens = Math.max(25, Math.round((nodeConfig.maxOutputTokens || 256) * 0.3));
          nodeTokens = {
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
          };
          totalTokens += nodeTokens.totalTokens;

          let generatedText = `[Simulated response from ${model}]: In response to "${userPrompt.slice(0, 80)}${userPrompt.length > 80 ? '...' : ''}", your request has been processed successfully according to system instructions.`;

          if (nodeConfig.responseFormat === 'json_object') {
            generatedText = JSON.stringify({
              status: 'processed',
              model,
              input_received: userPrompt,
              summary: 'Structured result generated from LLM completion.',
            });
          }

          nodeOutput = {
            text: generatedText,
            model,
            systemPrompt,
          };
          state.llm_output = generatedText;
          state[node.data.outputVar || 'llm_output'] = generatedText;
          break;
        }

        case 'agent': {
          const instructions = interpolateTemplate(nodeConfig.instructions || '', state);
          const tools = nodeConfig.availableTools || ['web_search'];
          const maxSteps = Math.min(nodeConfig.maxIterations || 5, 4);

          toolCalls = [];
          for (let step = 1; step <= Math.min(tools.length, maxSteps); step++) {
            const toolName = tools[step - 1];
            toolCalls.push({
              id: `tool_${step}_${Date.now()}`,
              toolName,
              arguments: { query: state.input?.user_message || 'diagnostic context', step },
              result: {
                found: true,
                summary: `Simulated data retrieved from tool "${toolName}".`,
                records: 3,
              },
              durationMs: 85 + step * 20,
              status: 'success',
            });
          }

          const promptTokens = 120 + toolCalls.length * 40;
          const completionTokens = 95;
          nodeTokens = {
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
          };
          totalTokens += nodeTokens.totalTokens;

          const agentAnswer = `Agent resolved request after ${toolCalls.length} tool iterations using: ${tools.join(', ')}. Action plan executed thoroughly.`;
          nodeOutput = {
            result: agentAnswer,
            toolsUsed: tools,
            iterations: toolCalls.length,
            instructionsApplied: instructions,
          };
          state.agent_output = agentAnswer;
          state[node.data.outputVar || 'agent_output'] = agentAnswer;
          break;
        }

        case 'http_request': {
          const url = interpolateTemplate(nodeConfig.url || '', state);
          nodeOutput = {
            status: 200,
            statusText: 'OK',
            url,
            data: {
              success: true,
              message: 'External endpoint reached successfully.',
              timestamp: new Date().toISOString(),
            },
          };
          const targetKey = nodeConfig.responseMapping?.targetStateKey || 'http_response';
          state[targetKey] = nodeOutput.data;
          break;
        }

        case 'transform': {
          const assignments = nodeConfig.assignments || [];
          const transformed: Record<string, any> = {};

          assignments.forEach((assign: any) => {
            if (assign.constantValue !== undefined && assign.constantValue !== '') {
              transformed[assign.targetKey] = assign.constantValue;
              state[assign.targetKey] = assign.constantValue;
            } else if (assign.sourceMapping) {
              const val = state[assign.sourceMapping] ?? state.input?.[assign.sourceMapping];
              transformed[assign.targetKey] = val;
              state[assign.targetKey] = val;
            }
          });

          nodeOutput = transformed;
          state[nodeConfig.outputMapping || 'transformed_data'] = transformed;
          break;
        }

        case 'structured_output': {
          let parsedSchema: any = {};
          try {
            parsedSchema = JSON.parse(nodeConfig.outputSchema || '{}');
          } catch {
            parsedSchema = {};
          }

          // Build synthetic object satisfying the schema properties
          const structuredResult: Record<string, any> = {};
          const props = parsedSchema.properties || {};
          Object.keys(props).forEach((propKey) => {
            const p = props[propKey];
            if (p.enum && p.enum.length > 0) {
              structuredResult[propKey] = p.enum[0];
            } else if (p.type === 'number') {
              structuredResult[propKey] = 0.95;
            } else if (p.type === 'boolean') {
              structuredResult[propKey] = true;
            } else {
              structuredResult[propKey] = `Validated ${propKey} value for workflow`;
            }
          });

          nodeOutput = structuredResult;
          state.structured_output = structuredResult;
          state[node.data.outputVar || 'structured_output'] = structuredResult;
          break;
        }

        case 'end': {
          const mappings = nodeConfig.outputMappings || [];
          const finalResult: Record<string, any> = {};

          if (mappings.length > 0) {
            mappings.forEach((m: any) => {
              finalResult[m.outputKey] = state[m.stateField] ?? `[Field ${m.stateField} not set]`;
            });
          } else {
            finalResult.response =
              state.agent_output || state.llm_output || state.structured_output || 'Execution complete';
          }

          if (nodeConfig.includeExecutionId) {
            finalResult.execution_id = executionId;
          }
          if (nodeConfig.includeMetadata) {
            finalResult.metadata = {
              started_at: startedAt,
              total_tokens: totalTokens,
              terminal_status: nodeConfig.terminalStatus || 'COMPLETED',
            };
          }

          nodeOutput = finalResult;
          state.final_output = finalResult;
          break;
        }
      }
    } catch (err: any) {
      nodeError = err.message || 'Execution error';
    }

    const durationMs = Date.now() - nodeStart;
    const trace: NodeExecutionTrace = {
      nodeId: node.id,
      nodeName: node.title,
      nodeType,
      status: nodeError ? 'failed' : 'success',
      inputData: { ...state.input },
      outputData: nodeOutput,
      selectedRoute,
      toolCalls,
      tokenUsage: nodeTokens.totalTokens > 0 ? nodeTokens : undefined,
      durationMs,
      error: nodeError,
      startedAt: new Date(nodeStart).toISOString(),
      finishedAt: new Date().toISOString(),
    };

    stepTraces.push(trace);
    options.onNodeFinish?.(node.id, trace);

    if (nodeError) {
      break;
    }

    // Determine Next Node
    const outEdges = outEdgesMap.get(node.id) || [];
    if (outEdges.length === 0) {
      // Reached terminus or disconnected branch
      break;
    }

    if (nodeType === 'condition' && selectedRoute) {
      // Find edge matching selectedRoute handle or label
      const matchedEdge =
        outEdges.find(
          (e) => e.sourceHandle === selectedRoute || e.label?.toLowerCase() === selectedRoute?.toLowerCase(),
        ) ||
        outEdges.find((e) => e.sourceHandle === 'default' || e.sourceHandle === 'fallback') ||
        outEdges[0];

      currentNodeId = matchedEdge ? matchedEdge.target : null;
    } else {
      currentNodeId = outEdges[0].target;
    }
  }

  const finishedAt = new Date().toISOString();
  const totalDurationMs = stepTraces.reduce((acc, t) => acc + t.durationMs, 0);

  const hasFailed = stepTraces.some((t) => t.status === 'failed');

  return {
    id: executionId,
    workflowId: graph.id || 'wf_current',
    version: graph.version || '1.0.0',
    status: hasFailed ? 'failed' : 'completed',
    inputs: options.inputs,
    outputs: state.final_output,
    state,
    stepTraces,
    totalDurationMs,
    totalTokens,
    startedAt,
    finishedAt,
  };
}
