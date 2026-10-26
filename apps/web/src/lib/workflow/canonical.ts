import type {
  CanonicalWorkflow,
  CanonicalNode,
  CanonicalEdge,
  WorkflowGraph,
  WorkflowNode,
  WorkflowEdge,
  CoreNodeType,
} from '../../types/workflow';
import {
  NODE_REGISTRY,
  defaultStartConfig,
  defaultConditionConfig,
  defaultStructuredOutputConfig,
  defaultEndConfig,
} from './registry';

export const CURRENT_SCHEMA_VERSION = '1.0.0';

/**
 * Converts a visual canvas WorkflowGraph into the versioned CanonicalWorkflow JSON format.
 */
export function serializeToCanonical(graph: WorkflowGraph): CanonicalWorkflow {
  // Extract inputSchema from start node if available
  const startNode = graph.nodes.find((n) => n.type === 'start');
  const inputSchema: Record<string, any> = {
    type: 'object',
    properties: {},
    required: [],
  };

  if (startNode?.data.config) {
    const config = startNode.data.config;
    if (Array.isArray(config.inputFields)) {
      config.inputFields.forEach((f: any) => {
        inputSchema.properties[f.name] = {
          type: f.type === 'json' ? 'object' : f.type,
          description: f.description || '',
          default: f.defaultValue,
        };
        if (f.required) {
          inputSchema.required.push(f.name);
        }
      });
    }
  }

  // Extract outputSchema from end node if available
  const endNode = graph.nodes.find((n) => n.type === 'end');
  const outputSchema: Record<string, any> = {
    type: 'object',
    properties: {},
  };

  if (endNode?.data.config?.outputMappings) {
    endNode.data.config.outputMappings.forEach((m: any) => {
      outputSchema.properties[m.outputKey] = {
        type: 'string',
        description: `Mapped from state field: ${m.stateField}`,
      };
    });
  }

  // Derive stateSchema from start, transform and node outputs
  const stateSchema: Record<string, any> = {
    input: inputSchema,
    system: { type: 'object' },
  };

  graph.nodes.forEach((node) => {
    if (node.data.outputVar) {
      stateSchema[node.data.outputVar] = { type: 'string', sourceNodeId: node.id };
    }
  });

  const canonicalNodes: CanonicalNode[] = graph.nodes.map((node) => {
    return {
      id: node.id,
      type: node.type,
      name: node.title || node.data.label,
      description: node.data.description,
      position: {
        x: Math.round(node.position.x),
        y: Math.round(node.position.y),
      },
      config: (node.data.config || NODE_REGISTRY[node.type]?.defaultConfig || {}) as any,
      metadata: {
        description: node.data.description,
      },
    };
  });

  const canonicalEdges: CanonicalEdge[] = graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    label: edge.label,
  }));

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    workflow: {
      id: graph.id || `wf_${Date.now()}`,
      name: graph.name || 'Untitled Workflow',
      version: graph.version || '1.0.0',
      description: graph.description || '',
    },
    inputSchema,
    outputSchema,
    stateSchema,
    settings: {
      maxExecutionDurationMs: 60000,
      maxNodeExecutions: 100,
    },
    nodes: canonicalNodes,
    edges: canonicalEdges,
  };
}

/**
 * Converts a CanonicalWorkflow JSON object into the visual canvas WorkflowGraph.
 */
export function deserializeFromCanonical(canonical: CanonicalWorkflow): WorkflowGraph {
  const nodes: WorkflowNode[] = canonical.nodes.map((cNode) => {
    const rawType = cNode.type as string;
    // Map legacy types to core types if needed
    let coreType: CoreNodeType = 'agent';
    if (rawType in NODE_REGISTRY) {
      coreType = rawType as CoreNodeType;
    } else if (rawType === 'classifier') {
      coreType = 'condition';
    } else if (rawType === 'tool' || rawType === 'api_request') {
      coreType = 'http_request';
    } else if (rawType === 'guardrail' || rawType === 'memory') {
      coreType = 'transform';
    }

    const reg = NODE_REGISTRY[coreType] || NODE_REGISTRY.agent;
    const config = { ...reg.defaultConfig, ...(cNode.config || {}) };

    return {
      id: cNode.id,
      type: coreType,
      title: cNode.name || reg.label,
      position: {
        x: cNode.position?.x ?? 200,
        y: cNode.position?.y ?? 200,
      },
      data: {
        label: cNode.name || reg.label,
        sublabel: reg.sublabel,
        description: cNode.description || reg.description,
        config,
      },
    };
  });

  const edges: WorkflowEdge[] = canonical.edges.map((cEdge) => ({
    id: cEdge.id,
    source: cEdge.source,
    target: cEdge.target,
    sourceHandle: cEdge.sourceHandle,
    targetHandle: cEdge.targetHandle,
    label: cEdge.label,
  }));

  return {
    id: canonical.workflow?.id,
    name: canonical.workflow?.name || 'Imported Workflow',
    version: canonical.workflow?.version || '1.0.0',
    description: canonical.workflow?.description,
    status: 'DRAFT',
    nodes,
    edges,
  };
}

/**
 * Validates and parses raw text into a valid CanonicalWorkflow or throws descriptive error.
 */
export function parseAndValidateWorkflowJson(rawText: string): CanonicalWorkflow {
  let parsed: any;
  try {
    parsed = JSON.parse(rawText);
  } catch (err: any) {
    throw new Error(`Invalid JSON syntax: ${err.message}`, { cause: err });
  }

  // Already canonical format
  if (parsed.schemaVersion === '1.0.0' && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
    return parsed as CanonicalWorkflow;
  }

  // Legacy studio graph with nodes and edges
  if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
    const visualGraph: WorkflowGraph = {
      name: parsed.name || 'Imported Workflow',
      version: parsed.version || '1.0.0',
      status: parsed.status || 'DRAFT',
      nodes: parsed.nodes.map((n: any, idx: number) => {
        let type: CoreNodeType = 'agent';
        if (n.type in NODE_REGISTRY) {
          type = n.type as CoreNodeType;
        } else if (n.type === 'classifier') {
          type = 'condition';
        } else if (n.type === 'tool' || n.type === 'api_request') {
          type = 'http_request';
        } else if (n.type === 'guardrail' || n.type === 'memory') {
          type = 'transform';
        }

        const reg = NODE_REGISTRY[type];
        return {
          id: n.id || `node_${idx + 1}`,
          type,
          title: n.title || n.data?.label || reg.label,
          position: n.position || { x: 200 + (idx % 3) * 260, y: 100 + Math.floor(idx / 3) * 160 },
          data: {
            label: n.title || n.data?.label || reg.label,
            sublabel: reg.sublabel,
            description: n.data?.description || reg.description,
            config: n.data?.config || reg.defaultConfig,
          },
        };
      }),
      edges: parsed.edges.map((e: any, idx: number) => ({
        id: e.id || `e_${idx + 1}`,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        label: e.label,
      })),
    };
    return serializeToCanonical(visualGraph);
  }

  throw new Error(
    'Unrecognized workflow format. Expected Canonical JSON v1.0.0 with "schemaVersion", "nodes", and "edges".',
  );
}

/**
 * Creates a standard production-ready default workflow (Customer Support Agent MVP).
 */
export function createDefaultCanonicalWorkflow(): CanonicalWorkflow {
  const visual: WorkflowGraph = {
    name: 'Customer Support Concierge',
    version: '1.0.0',
    description: 'Autonomous customer support agent with condition routing and structured outcome.',
    status: 'DRAFT',
    nodes: [
      {
        id: 'node_start',
        type: 'start',
        title: 'Customer Inquiry',
        position: { x: 380, y: 40 },
        data: {
          label: 'Customer Inquiry',
          sublabel: 'TRIGGER',
          description: 'Receives user question and session context',
          config: defaultStartConfig,
        },
      },
      {
        id: 'node_condition',
        type: 'condition',
        title: 'Intent Router',
        position: { x: 380, y: 180 },
        data: {
          label: 'Intent Router',
          sublabel: 'LOGIC BRANCH',
          description: 'Routes by technical vs billing query keywords',
          config: defaultConditionConfig,
        },
      },
      {
        id: 'node_llm_billing',
        type: 'llm',
        title: 'Billing Specialist',
        position: { x: 180, y: 350 },
        data: {
          label: 'Billing Specialist',
          sublabel: 'PROMPT / MODEL',
          description: 'Resolves pricing, refunds and subscription queries',
          config: {
            ...NODE_REGISTRY.llm.defaultConfig,
            systemPrompt: 'You are a billing and subscription assistant. Address billing questions concisely.',
            userPrompt: 'Customer inquiry: {input.user_message}',
          },
        },
      },
      {
        id: 'node_agent_tech',
        type: 'agent',
        title: 'Tech Diagnostics Agent',
        position: { x: 580, y: 350 },
        data: {
          label: 'Tech Diagnostics Agent',
          sublabel: 'REACT LOOP',
          description: 'Autonomous agent that diagnoses code and system issues using tools',
          config: {
            ...NODE_REGISTRY.agent.defaultConfig,
            instructions: 'You are a senior technical support engineer. Use tools to diagnose the bug.',
            availableTools: ['knowledge_base', 'web_search'],
          },
        },
      },
      {
        id: 'node_structured_out',
        type: 'structured_output',
        title: 'Format Output',
        position: { x: 380, y: 520 },
        data: {
          label: 'Format Output',
          sublabel: 'SCHEMA VALIDATOR',
          description: 'Validates JSON output schema compliance',
          config: defaultStructuredOutputConfig,
        },
      },
      {
        id: 'node_end',
        type: 'end',
        title: 'Return Response',
        position: { x: 380, y: 680 },
        data: {
          label: 'Return Response',
          sublabel: 'TERMINUS',
          description: 'Sends final structured response to customer',
          config: defaultEndConfig,
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'node_start', target: 'node_condition' },
      {
        id: 'e2',
        source: 'node_condition',
        target: 'node_llm_billing',
        sourceHandle: 'route_billing',
        label: 'Billing Branch',
      },
      {
        id: 'e3',
        source: 'node_condition',
        target: 'node_agent_tech',
        sourceHandle: 'route_technical',
        label: 'Technical Branch',
      },
      { id: 'e4', source: 'node_llm_billing', target: 'node_structured_out' },
      { id: 'e5', source: 'node_agent_tech', target: 'node_structured_out' },
      { id: 'e6', source: 'node_structured_out', target: 'node_end' },
    ],
  };

  return serializeToCanonical(visual);
}
