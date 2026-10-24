import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  type MouseEvent,
  type WheelEvent,
  type KeyboardEvent,
} from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Bot,
  Play,
  Save,
  Code2,
  Sparkles,
  Plus,
  Minus,
  Maximize2,
  Trash2,
  Send,
  Loader2,
  Wrench,
  CheckCircle2,
  Cpu,
  Copy,
  Check,
  X,
  Database,
  Code,
  UserCheck,
  GitFork,
  Sliders,
  Split,
  Globe,
  Shield,
  HardDrive,
  Download,
  AlertCircle,
  RefreshCw,
  Layers,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useProject, useUpdateProject } from '../hooks/useProjects';
import type {
  WorkflowNode,
  WorkflowEdge,
  WorkflowGraph,
  NodeType,
  RouteOption,
  InputParameter,
} from '../types/workflow';

// ── Node Dimension Constants ──────────────────────────────────────────
export const NODE_WIDTH = 230;
export const NODE_HEIGHT = 86;

// ── Helper: Node Category Meta & Visual Styling ───────────────────────
export function getNodeMeta(type: NodeType) {
  switch (type) {
    case 'start':
      return {
        icon: <CheckCircle2 className="size-3 text-emerald-400" />,
        border: 'border-emerald-500/50',
        badge: 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/40',
        accent: '#10b981',
        category: 'Control Flow',
      };
    case 'classifier':
      return {
        icon: <Split className="size-3 text-sky-400" />,
        border: 'border-sky-500/50',
        badge: 'bg-sky-950/70 text-sky-300 border border-sky-800/40',
        accent: '#38bdf8',
        category: 'Control Flow',
      };
    case 'condition':
      return {
        icon: <GitFork className="size-3 text-orange-400" />,
        border: 'border-orange-500/50',
        badge: 'bg-orange-950/70 text-orange-300 border border-orange-800/40',
        accent: '#fb923c',
        category: 'Control Flow',
      };
    case 'end':
      return {
        icon: <CheckCircle2 className="size-3 text-neutral-400" />,
        border: 'border-neutral-600/50',
        badge: 'bg-neutral-800 text-neutral-300 border border-neutral-700/40',
        accent: '#a1a1aa',
        category: 'Control Flow',
      };
    case 'agent':
      return {
        icon: <Bot className="size-3 text-brand-400" />,
        border: 'border-brand-500/50',
        badge: 'bg-brand-950/70 text-brand-300 border border-brand-800/40',
        accent: '#818cf8',
        category: 'AI & Intelligence',
      };
    case 'llm':
      return {
        icon: <Cpu className="size-3 text-purple-400" />,
        border: 'border-purple-500/50',
        badge: 'bg-purple-950/70 text-purple-300 border border-purple-800/40',
        accent: '#c084fc',
        category: 'AI & Intelligence',
      };
    case 'rag':
      return {
        icon: <Database className="size-3 text-cyan-400" />,
        border: 'border-cyan-500/50',
        badge: 'bg-cyan-950/70 text-cyan-300 border border-cyan-800/40',
        accent: '#22d3ee',
        category: 'AI & Intelligence',
      };
    case 'tool':
      return {
        icon: <Wrench className="size-3 text-amber-400" />,
        border: 'border-amber-500/50',
        badge: 'bg-amber-950/70 text-amber-300 border border-amber-800/40',
        accent: '#fbbf24',
        category: 'Tools & APIs',
      };
    case 'api_request':
      return {
        icon: <Globe className="size-3 text-teal-400" />,
        border: 'border-teal-500/50',
        badge: 'bg-teal-950/70 text-teal-300 border border-teal-800/40',
        accent: '#2dd4bf',
        category: 'Tools & APIs',
      };
    case 'transform':
      return {
        icon: <Code className="size-3 text-fuchsia-400" />,
        border: 'border-fuchsia-500/50',
        badge: 'bg-fuchsia-950/70 text-fuchsia-300 border border-fuchsia-800/40',
        accent: '#e879f9',
        category: 'Tools & APIs',
      };
    case 'guardrail':
      return {
        icon: <Shield className="size-3 text-rose-400" />,
        border: 'border-rose-500/50',
        badge: 'bg-rose-950/70 text-rose-300 border border-rose-800/40',
        accent: '#fb7185',
        category: 'Safety & State',
      };
    case 'memory':
      return {
        icon: <HardDrive className="size-3 text-indigo-400" />,
        border: 'border-indigo-500/50',
        badge: 'bg-indigo-950/70 text-indigo-300 border border-indigo-800/40',
        accent: '#818cf8',
        category: 'Safety & State',
      };
    case 'human':
      return {
        icon: <UserCheck className="size-3 text-pink-400" />,
        border: 'border-pink-500/50',
        badge: 'bg-pink-950/70 text-pink-300 border border-pink-800/40',
        accent: '#f472b6',
        category: 'Safety & State',
      };
  }
}

// ── Default Initial Graph (Customer Concierge Flow) ───────────────────
export const DEFAULT_INITIAL_GRAPH: WorkflowGraph = {
  name: 'Customer Concierge Flow',
  version: '0.1.0',
  status: 'DRAFT',
  nodes: [
    {
      id: 'node-start',
      type: 'start',
      title: 'Incoming Message',
      position: { x: 380, y: 50 },
      data: {
        label: 'Incoming Message',
        sublabel: '01 / START',
        description: 'Receives customer question & session ID',
        outputVar: 'user_message',
        inputParams: [
          { name: 'user_message', type: 'string', required: true, description: 'Customer query' },
          { name: 'session_id', type: 'string', required: true, description: 'Active session UUID' },
        ],
      },
    },
    {
      id: 'node-classifier',
      type: 'classifier',
      title: 'Intent Classifier',
      position: { x: 380, y: 190 },
      data: {
        label: 'Intent Classifier',
        sublabel: '02 / ROUTER',
        description: 'Routes by intent: Technical vs Billing',
        inputVar: 'user_message',
        classifierMode: 'semantic',
        routes: [
          { id: 'r1', label: 'Technical Issue', targetNodeId: 'node-tech-agent' },
          { id: 'r2', label: 'Billing & Invoice', targetNodeId: 'node-billing-agent' },
        ],
        fallbackRoute: 'General Inquiries',
      },
    },
    {
      id: 'node-tech-agent',
      type: 'agent',
      title: 'Technical Support Agent',
      position: { x: 200, y: 350 },
      data: {
        label: 'Technical Support Agent',
        sublabel: '03 / AGENT',
        description: 'Claude 3.5 Sonnet · Vector DB attached',
        model: 'claude-3-5-sonnet',
        temperature: 0.2,
        maxSteps: 6,
        systemPrompt:
          'You are a senior technical support engineer. Inspect errors and provide exact solutions.',
        tools: ['knowledge_base'],
        outputVar: 'tech_solution',
      },
    },
    {
      id: 'node-billing-agent',
      type: 'agent',
      title: 'Billing Concierge',
      position: { x: 560, y: 350 },
      data: {
        label: 'Billing Concierge',
        sublabel: '03 / AGENT',
        description: 'GPT-4o mini · Stripe API tool',
        model: 'gpt-4o-mini',
        temperature: 0.1,
        maxSteps: 4,
        systemPrompt:
          'You handle billing, receipts, subscription tiers, and refund verification.',
        tools: ['custom_api'],
        outputVar: 'billing_response',
      },
    },
    {
      id: 'node-human-check',
      type: 'human',
      title: 'Refund Approval',
      position: { x: 560, y: 500 },
      data: {
        label: 'Human Review',
        sublabel: '04 / OVERSIGHT',
        description: 'Supervisory check for refunds > $50',
        approvalPrompt: 'Customer requested subscription refund over $50. Approve payout?',
        timeoutMinutes: 30,
        timeoutAction: 'escalate',
      },
    },
    {
      id: 'node-end',
      type: 'end',
      title: 'Return Output',
      position: { x: 380, y: 650 },
      data: {
        label: 'Return Output',
        sublabel: '05 / END',
        description: 'Streams response back to customer channel',
        endResponseTemplate: '{{agent_output}}',
        endDeliveryType: 'chat_message',
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'node-start', target: 'node-classifier' },
    { id: 'e2', source: 'node-classifier', target: 'node-tech-agent', label: 'Technical Issue' },
    { id: 'e3', source: 'node-classifier', target: 'node-billing-agent', label: 'Billing & Invoice' },
    { id: 'e4', source: 'node-tech-agent', target: 'node-end' },
    { id: 'e5', source: 'node-billing-agent', target: 'node-human-check' },
    { id: 'e6', source: 'node-human-check', target: 'node-end' },
  ],
};

// ── Blueprint Templates ───────────────────────────────────────────────
export const TEMPLATES: Record<
  string,
  { name: string; description: string; graph: WorkflowGraph }
> = {
  intent_router: {
    name: 'Multi-Agent Intent Router',
    description: 'Classifier routing between specialized tech and billing agents',
    graph: DEFAULT_INITIAL_GRAPH,
  },
  rag_researcher: {
    name: 'RAG Knowledge Synthesis',
    description: 'Vector search retrieval pipeline with GPT-4o synthesis',
    graph: {
      name: 'RAG Knowledge Synthesis',
      version: '0.1.0',
      status: 'DRAFT',
      nodes: [
        {
          id: 'n-start',
          type: 'start',
          title: 'Research Query',
          position: { x: 380, y: 50 },
          data: {
            label: 'Research Query',
            sublabel: '01 / START',
            outputVar: 'query',
            inputParams: [{ name: 'query', type: 'string', required: true }],
          },
        },
        {
          id: 'n-rag',
          type: 'rag',
          title: 'Vector Knowledge Retrieval',
          position: { x: 380, y: 190 },
          data: {
            label: 'Vector Knowledge Base',
            sublabel: '02 / RAG',
            ragCollection: 'company_documentation',
            queryTemplate: '{query}',
            topK: 4,
            similarityThreshold: 0.8,
            outputVar: 'retrieved_docs',
          },
        },
        {
          id: 'n-agent',
          type: 'agent',
          title: 'Synthesizer Agent',
          position: { x: 380, y: 340 },
          data: {
            label: 'Synthesizer Agent',
            sublabel: '03 / AGENT',
            model: 'gpt-4o',
            tools: ['web_search'],
            systemPrompt: 'Synthesize internal docs and live web search findings into a coherent report.',
            outputVar: 'final_report',
          },
        },
        {
          id: 'n-end',
          type: 'end',
          title: 'Deliver Report',
          position: { x: 380, y: 490 },
          data: {
            label: 'Deliver Report',
            sublabel: '04 / END',
            endResponseTemplate: '{{final_report}}',
          },
        },
      ],
      edges: [
        { id: 're1', source: 'n-start', target: 'n-rag' },
        { id: 're2', source: 'n-rag', target: 'n-agent' },
        { id: 're3', source: 'n-agent', target: 'n-end' },
      ],
    },
  },
  safety_guardrail: {
    name: 'Safety Guardrailed Pipeline',
    description: 'Content moderation filter with state memory and agent loop',
    graph: {
      name: 'Safety Guardrailed Pipeline',
      version: '0.1.0',
      status: 'DRAFT',
      nodes: [
        {
          id: 'sg-start',
          type: 'start',
          title: 'User Input',
          position: { x: 380, y: 50 },
          data: { label: 'User Input', sublabel: 'START', outputVar: 'user_prompt' },
        },
        {
          id: 'sg-guard',
          type: 'guardrail',
          title: 'Prompt Injection & Safety Filter',
          position: { x: 380, y: 180 },
          data: {
            label: 'Safety Guardrail',
            sublabel: 'FILTER',
            guardrailRules: ['injection', 'pii', 'toxic'],
            moderationAction: 'block',
          },
        },
        {
          id: 'sg-agent',
          type: 'agent',
          title: 'Safe Task Agent',
          position: { x: 380, y: 320 },
          data: {
            label: 'Task Agent',
            sublabel: 'AGENT',
            model: 'gpt-4o-mini',
            outputVar: 'agent_res',
          },
        },
        {
          id: 'sg-mem',
          type: 'memory',
          title: 'Conversation Memory Store',
          position: { x: 380, y: 460 },
          data: {
            label: 'State Store',
            sublabel: 'MEMORY',
            stateAction: 'write',
            stateKey: 'chat_history',
          },
        },
        {
          id: 'sg-end',
          type: 'end',
          title: 'Safe Output Stream',
          position: { x: 380, y: 600 },
          data: { label: 'Return Result', sublabel: 'END' },
        },
      ],
      edges: [
        { id: 'sge1', source: 'sg-start', target: 'sg-guard' },
        { id: 'sge2', source: 'sg-guard', target: 'sg-agent' },
        { id: 'sge3', source: 'sg-agent', target: 'sg-mem' },
        { id: 'sge4', source: 'sg-mem', target: 'sg-end' },
      ],
    },
  },
};

// ── LangGraph Canonical Specification ─────────────────────────────────
export interface LangGraphCompiled {
  __schema__: 'langgraph_v1';
  name: string;
  version: string;
  entry_point: string;
  nodes: Record<
    string,
    {
      id: string;
      type: NodeType;
      title: string;
      output_var?: string;
      config: Record<string, any>;
    }
  >;
  edges: Array<{
    source: string;
    target: string;
  }>;
  conditional_edges: Array<{
    source: string;
    condition_type: 'intent_classifier' | 'expression_evaluator' | 'branch_router';
    routing_key?: string;
    expression?: string;
    routes: Record<string, string>;
    fallback?: string;
  }>;
  state_schema: Record<string, string>;
}

// ── Compiler: Convert Visual Graph into LangGraph Execution JSON ──────
export function compileLangGraphJSON(graph: WorkflowGraph): LangGraphCompiled {
  const startNode = graph.nodes.find((n) => n.type === 'start');
  const firstEdge = graph.edges.find((e) => e.source === startNode?.id);
  const entry_point = firstEdge?.target || startNode?.id || graph.nodes[0]?.id || 'entry';

  // 1. Process Nodes
  const nodesMap: LangGraphCompiled['nodes'] = {};
  graph.nodes.forEach((n) => {
    const config: Record<string, any> = {};
    if (n.type === 'agent') {
      config.model = n.data.model || 'gpt-4o-mini';
      config.temperature = n.data.temperature ?? 0.3;
      config.max_steps = n.data.maxSteps ?? 5;
      config.system_prompt = n.data.systemPrompt;
      config.tools = n.data.tools || [];
      config.memory_type = n.data.memoryType || 'buffer';
    } else if (n.type === 'llm') {
      config.model = n.data.model || 'gpt-4o-mini';
      config.temperature = n.data.temperature ?? 0.2;
      config.max_tokens = n.data.maxTokens ?? 1024;
      config.response_format = n.data.responseFormat || 'text';
      config.system_prompt = n.data.systemPrompt;
      config.user_prompt = n.data.userPrompt;
    } else if (n.type === 'classifier') {
      config.classifier_mode = n.data.classifierMode || 'semantic';
      config.input_var = n.data.inputVar || 'user_message';
      config.routes = n.data.routes || [];
      config.fallback_route = n.data.fallbackRoute || 'default';
    } else if (n.type === 'condition') {
      config.expression = n.data.conditionExpr || 'true';
      config.true_branch = n.data.trueBranchLabel || 'TRUE';
      config.false_branch = n.data.falseBranchLabel || 'FALSE';
    } else if (n.type === 'tool') {
      config.tool_type = n.data.toolType || 'web_search';
      config.description = n.data.description;
      config.tool_config = n.data.toolConfig || {};
    } else if (n.type === 'rag') {
      config.collection = n.data.ragCollection || 'knowledge_base';
      config.query_template = n.data.queryTemplate || '{user_message}';
      config.top_k = n.data.topK ?? 3;
      config.similarity_threshold = n.data.similarityThreshold ?? 0.75;
    } else if (n.type === 'api_request') {
      config.method = n.data.apiMethod || 'POST';
      config.url = n.data.apiUrl || '';
      config.headers = n.data.apiHeaders;
      config.body = n.data.apiBody;
    } else if (n.type === 'guardrail') {
      config.rules = n.data.guardrailRules || ['injection', 'pii'];
      config.action = n.data.moderationAction || 'block';
    } else if (n.type === 'memory') {
      config.action = n.data.stateAction || 'read';
      config.state_key = n.data.stateKey || 'session_state';
    } else if (n.type === 'transform') {
      config.code = n.data.transformCode || 'return input;';
    } else if (n.type === 'human') {
      config.approval_prompt = n.data.approvalPrompt;
      config.timeout_minutes = n.data.timeoutMinutes ?? 60;
      config.timeout_action = n.data.timeoutAction || 'escalate';
    } else if (n.type === 'start') {
      config.input_parameters = n.data.inputParams || [];
    } else if (n.type === 'end') {
      config.response_template = n.data.endResponseTemplate || '{{agent_output}}';
      config.delivery_channel = n.data.endDeliveryType || 'chat_message';
    }

    nodesMap[n.id] = {
      id: n.id,
      type: n.type,
      title: n.title,
      output_var: n.data.outputVar,
      config,
    };
  });

  // 2. Identify Conditional vs Standard Edges
  const standardEdges: LangGraphCompiled['edges'] = [];
  const conditionalNodesMap: Record<
    string,
    {
      source: string;
      condition_type: 'intent_classifier' | 'expression_evaluator' | 'branch_router';
      routing_key?: string;
      expression?: string;
      routes: Record<string, string>;
      fallback?: string;
    }
  > = {};

  graph.edges.forEach((edge) => {
    const src = graph.nodes.find((n) => n.id === edge.source);
    if (!src) return;

    if (src.type === 'classifier' || src.type === 'condition' || Boolean(edge.label)) {
      if (!conditionalNodesMap[src.id]) {
        conditionalNodesMap[src.id] = {
          source: src.id,
          condition_type:
            src.type === 'classifier'
              ? 'intent_classifier'
              : src.type === 'condition'
              ? 'expression_evaluator'
              : 'branch_router',
          routing_key: src.data.inputVar || 'user_message',
          expression: src.data.conditionExpr,
          routes: {},
          fallback: src.data.fallbackRoute || 'default',
        };
      }
      const label = edge.label || `route_${Object.keys(conditionalNodesMap[src.id].routes).length + 1}`;
      conditionalNodesMap[src.id].routes[label] = edge.target;
    } else {
      standardEdges.push({ source: edge.source, target: edge.target });
    }
  });

  // 3. Dynamic State Schema Extraction
  const stateSchema: Record<string, string> = {
    messages: 'list[BaseMessage]',
  };
  if (startNode?.data.inputParams) {
    startNode.data.inputParams.forEach((param) => {
      stateSchema[param.name] = param.type === 'number' ? 'int' : param.type === 'boolean' ? 'bool' : 'str';
    });
  }
  graph.nodes.forEach((n) => {
    if (n.data.outputVar) {
      stateSchema[n.data.outputVar] = 'str';
    }
    if (n.data.stateKey) {
      stateSchema[n.data.stateKey] = 'dict';
    }
  });

  return {
    __schema__: 'langgraph_v1',
    name: graph.name || 'Untitled Workflow',
    version: graph.version || '0.1.0',
    entry_point,
    nodes: nodesMap,
    edges: standardEdges,
    conditional_edges: Object.values(conditionalNodesMap),
    state_schema: stateSchema,
  };
}

// ── Workflow Graph Validation ─────────────────────────────────────────
export function validateWorkflow(graph: WorkflowGraph): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  const startNodes = graph.nodes.filter((n) => n.type === 'start');
  const endNodes = graph.nodes.filter((n) => n.type === 'end');

  if (startNodes.length === 0) {
    issues.push('Missing Start Trigger node (required entry point).');
  } else if (startNodes.length > 1) {
    issues.push('Multiple Start Trigger nodes detected. Only one is allowed.');
  }

  if (endNodes.length === 0) {
    issues.push('Missing End Return node (workflow must have a terminus).');
  }

  if (graph.nodes.length > 1) {
    const connectedNodeIds = new Set<string>();
    graph.edges.forEach((e) => {
      connectedNodeIds.add(e.source);
      connectedNodeIds.add(e.target);
    });
    graph.nodes.forEach((n) => {
      if (!connectedNodeIds.has(n.id)) {
        issues.push(`Disconnected node: "${n.title}" has no connections.`);
      }
    });
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

// ── Smart JSON Import (LangGraph Spec or Visual Studio JSON) ──────────
export function importWorkflowJSON(rawText: string): WorkflowGraph {
  const parsed = JSON.parse(rawText);

  // Check if it is a raw Studio WorkflowGraph
  if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
    return parsed as WorkflowGraph;
  }

  // Check if it is a LangGraphCompiled format
  if (parsed.__schema__ === 'langgraph_v1' || parsed.nodes) {
    const nodes: WorkflowNode[] = [];
    const edges: WorkflowEdge[] = [];
    const rawNodes = parsed.nodes;

    let index = 0;
    const nodeIds = Object.keys(rawNodes);

    nodeIds.forEach((id) => {
      const nodeDef = rawNodes[id];
      const type: NodeType = nodeDef.type || 'agent';
      const col = index % 3;
      const row = Math.floor(index / 3);

      nodes.push({
        id: nodeDef.id || id,
        type,
        title: nodeDef.title || id,
        position: { x: 180 + col * 280, y: 60 + row * 160 },
        data: {
          label: nodeDef.title || id,
          sublabel: type.toUpperCase(),
          outputVar: nodeDef.output_var,
          ...(nodeDef.config || {}),
        },
      });
      index++;
    });

    if (Array.isArray(parsed.edges)) {
      parsed.edges.forEach((e: any, i: number) => {
        edges.push({
          id: `imp-e-${i}`,
          source: e.source,
          target: e.target,
        });
      });
    }

    if (Array.isArray(parsed.conditional_edges)) {
      parsed.conditional_edges.forEach((ce: any, i: number) => {
        if (ce.routes) {
          Object.entries(ce.routes).forEach(([label, targetId], ri) => {
            edges.push({
              id: `imp-ce-${i}-${ri}`,
              source: ce.source,
              target: targetId as string,
              label,
            });
          });
        }
      });
    }

    return {
      name: parsed.name || 'Imported LangGraph Workflow',
      version: parsed.version || '1.0.0',
      status: 'DRAFT',
      nodes,
      edges,
    };
  }

  throw new Error('Unsupported JSON format. Expected LangGraph v1 schema or Studio Graph state.');
}

// ── Reusable Form Input Sub-components ─────────────────────────────────
function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  fontMono = false,
}: {
  label: string;
  value: string | number;
  onChange: (val: string) => void;
  placeholder?: string;
  type?: string;
  fontMono?: boolean;
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-neutral-400 mb-1">{label}</label>
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-xs text-white placeholder-neutral-500 focus:border-brand-500 focus:outline-none ${
          fontMono ? 'font-mono text-[11px]' : ''
        }`}
      />
    </div>
  );
}

function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (val: T) => void;
  options: { label: string; value: T }[];
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-neutral-400 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-xs text-white focus:border-brand-500 focus:outline-none"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-neutral-900 text-white">
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  fontMono = false,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  rows?: number;
  fontMono?: boolean;
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-neutral-400 mb-1">{label}</label>
      <textarea
        rows={rows}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-lg border border-neutral-800 bg-neutral-900 p-2 text-xs text-white placeholder-neutral-500 focus:border-brand-500 focus:outline-none ${
          fontMono ? 'font-mono text-[11px]' : ''
        }`}
      />
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step = 0.05,
  unit = '',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (val: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] font-medium text-neutral-400 mb-1">
        <span>{label}</span>
        <span className="font-mono text-white">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-brand-500 cursor-pointer"
      />
    </div>
  );
}

// ── Palette Categorization List ───────────────────────────────────────
export const PALETTE_CATEGORIES: {
  name: string;
  items: { type: NodeType; title: string; desc: string }[];
}[] = [
  {
    name: 'Control Flow',
    items: [
      { type: 'start', title: 'Input Trigger', desc: 'Entry point for user message & payload' },
      { type: 'classifier', title: 'Intent Classifier', desc: 'Semantic routing to branch agents' },
      { type: 'condition', title: 'Condition Rule', desc: 'Boolean IF/ELSE branch evaluation' },
      { type: 'end', title: 'Return Output', desc: 'Final response delivery channel' },
    ],
  },
  {
    name: 'AI & Intelligence',
    items: [
      { type: 'agent', title: 'Autonomous Agent', desc: 'Iterative ReAct loop with tools' },
      { type: 'llm', title: 'Prompt Completion', desc: 'Single-pass model inference' },
      { type: 'rag', title: 'Vector Knowledge', desc: 'Embeddings search & document fetch' },
    ],
  },
  {
    name: 'Tools & APIs',
    items: [
      { type: 'tool', title: 'External Tool', desc: 'Web search, SQL, or code execution' },
      { type: 'api_request', title: 'HTTP / Webhook', desc: 'External REST API integration' },
      { type: 'transform', title: 'Code Transform', desc: 'Custom JavaScript data mapping' },
    ],
  },
  {
    name: 'Safety & State',
    items: [
      { type: 'guardrail', title: 'Safety Guardrail', desc: 'Content moderation & injection check' },
      { type: 'memory', title: 'Memory Store', desc: 'Session memory read & write' },
      { type: 'human', title: 'Human Review', desc: 'Approval gate before sensitive action' },
    ],
  },
];

export default function ProjectStudioPage() {
  const { id: projectId = '' } = useParams<{ id: string }>();
  const { data: project, isLoading } = useProject(projectId);
  const updateProjectMutation = useUpdateProject();

  // Workflow State
  const [graph, setGraph] = useState<WorkflowGraph>(DEFAULT_INITIAL_GRAPH);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [isConnectingFrom, setIsConnectingFrom] = useState<string | null>(null);

  // Pan & Zoom Virtual Viewport
  const [pan, setPan] = useState({ x: 140, y: 50 });
  const [zoom, setZoom] = useState(1.0);

  // Drawers & Modals
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const [isCopilotOpen, setIsCopilotOpen] = useState(true);
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [jsonModalTab, setJsonModalTab] = useState<'langgraph' | 'studio' | 'import'>('langgraph');
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Editable Project Name
  const [projectName, setProjectName] = useState('Untitled Project');
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  // AI Copilot Chat State
  const [chatInput, setChatInput] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [messages, setMessages] = useState<
    Array<{
      id: string;
      role: 'user' | 'assistant';
      content: string;
      suggestedGraph?: WorkflowGraph;
      timestamp: Date;
    }>
  >([
    {
      id: 'init-1',
      role: 'assistant',
      content:
        'Hello! I am your LangGraph workflow architect. Ask me to design multi-agent systems, add RAG pipelines, or configure intent routing.',
      timestamp: new Date(),
    },
  ]);

  // Canvas Drag & Pan Tracking Refs
  const canvasRef = useRef<HTMLDivElement>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const draggingNodeIdRef = useRef<string | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Sync Project Data from Backend
  useEffect(() => {
    if (project?.name) {
      setProjectName(project.name);
    }
    if (project?.workflows?.[0]?.graph) {
      try {
        const loaded = project.workflows[0].graph as unknown as WorkflowGraph;
        if (loaded.nodes && loaded.edges) {
          setGraph(loaded);
          return;
        }
      } catch {
        // Fallback
      }
    }

    try {
      const savedLocal = localStorage.getItem(`quickgent_workflow_${projectId}`);
      if (savedLocal) {
        const parsed = JSON.parse(savedLocal);
        if (parsed.nodes && parsed.edges) {
          setGraph(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, [project, projectId]);

  // Live Compiled LangGraph Specification & Validation
  const validation = useMemo(() => validateWorkflow(graph), [graph]);
  const compiledLangGraph = useMemo(() => compileLangGraphJSON(graph), [graph]);
  const selectedNode = useMemo(
    () => graph.nodes.find((n) => n.id === selectedNodeId) || null,
    [graph.nodes, selectedNodeId],
  );

  // ── Handlers ─────────────────────────────────────────────────────────

  const handleSaveTitle = () => {
    setIsEditingTitle(false);
    if (projectName.trim() && projectName !== project?.name) {
      updateProjectMutation.mutate({
        id: projectId,
        data: { name: projectName.trim() },
      });
    }
  };

  const handleSaveWorkflow = () => {
    setSaveStatus('saving');
    try {
      localStorage.setItem(`quickgent_workflow_${projectId}`, JSON.stringify(graph));
    } catch {
      // ignore storage quota issues
    }

    if (projectName.trim() && projectName !== project?.name) {
      updateProjectMutation.mutate({
        id: projectId,
        data: { name: projectName.trim() },
      });
    }

    setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    }, 400);
  };

  // Fit View: Compute Bounding Box and Center Viewport
  const handleFitView = useCallback(() => {
    if (graph.nodes.length === 0 || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const padding = 70;

    const minX = Math.min(...graph.nodes.map((n) => n.position.x));
    const maxX = Math.max(...graph.nodes.map((n) => n.position.x + NODE_WIDTH));
    const minY = Math.min(...graph.nodes.map((n) => n.position.y));
    const maxY = Math.max(...graph.nodes.map((n) => n.position.y + NODE_HEIGHT));

    const graphW = Math.max(100, maxX - minX);
    const graphH = Math.max(100, maxY - minY);

    const scaleX = (rect.width - padding * 2) / graphW;
    const scaleY = (rect.height - padding * 2) / graphH;
    const newZoom = Math.min(1.2, Math.max(0.45, Math.min(scaleX, scaleY)));

    const centerX = (rect.width - graphW * newZoom) / 2;
    const centerY = (rect.height - graphH * newZoom) / 2;

    setPan({
      x: Math.round(centerX - minX * newZoom),
      y: Math.round(centerY - minY * newZoom),
    });
    setZoom(newZoom);
  }, [graph.nodes]);

  // Duplicate Selected Node
  const handleDuplicateNode = (nodeId: string) => {
    const src = graph.nodes.find((n) => n.id === nodeId);
    if (!src) return;

    const newId = `node-${src.type}-${Date.now().toString().slice(-4)}`;
    const duplicated: WorkflowNode = {
      ...src,
      id: newId,
      title: `${src.title} (Copy)`,
      position: {
        x: src.position.x + 35,
        y: src.position.y + 35,
      },
      data: {
        ...src.data,
        label: `${src.data.label} (Copy)`,
        routes: src.data.routes?.map((r) => ({
          ...r,
          id: `r-${Date.now().toString().slice(-4)}-${Math.random().toString(36).slice(2, 5)}`,
        })),
      },
    };

    setGraph((prev) => ({
      ...prev,
      nodes: [...prev.nodes, duplicated],
    }));
    setSelectedNodeId(newId);
    setSelectedEdgeId(null);
  };

  // Add Node from Palette at Current Viewport Center
  const handleAddNode = (type: NodeType) => {
    const newId = `node-${type}-${Date.now().toString().slice(-4)}`;
    const titles: Record<NodeType, string> = {
      start: 'Input Trigger',
      classifier: 'Intent Classifier',
      agent: 'Autonomous Agent',
      llm: 'Prompt Completion',
      rag: 'Vector Knowledge',
      tool: 'External Tool',
      api_request: 'HTTP / Webhook',
      guardrail: 'Safety Guardrail',
      memory: 'State Memory Store',
      condition: 'Condition Evaluator',
      transform: 'Code Transform',
      human: 'Human Review',
      end: 'Return Output',
    };

    let posX = 380;
    let posY = 260;
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      posX = Math.round((rect.width / 2 - pan.x) / zoom - NODE_WIDTH / 2);
      posY = Math.round((rect.height / 2 - pan.y) / zoom - NODE_HEIGHT / 2);
    }

    const newNode: WorkflowNode = {
      id: newId,
      type,
      title: titles[type],
      position: { x: Math.max(40, posX), y: Math.max(40, posY) },
      data: {
        label: titles[type],
        sublabel: type.toUpperCase(),
        description: `${type} node configuration`,
        outputVar: `${type}_output`,
        ...(type === 'start' && {
          inputParams: [
            { name: 'user_message', type: 'string', required: true, description: 'Customer query' },
            { name: 'session_id', type: 'string', required: false, description: 'Client session ID' },
          ],
        }),
        ...(type === 'agent' && {
          model: 'gpt-4o-mini',
          temperature: 0.3,
          maxSteps: 5,
          tools: ['web_search'],
          memoryType: 'buffer',
          systemPrompt:
            'You are an autonomous AI agent. Use your available tools iteratively to solve the user query.',
        }),
        ...(type === 'llm' && {
          model: 'gpt-4o-mini',
          temperature: 0.2,
          maxTokens: 1024,
          responseFormat: 'text',
          systemPrompt: 'You are a concise, helpful assistant.',
          userPrompt: 'Process the following input: {user_message}',
        }),
        ...(type === 'classifier' && {
          classifierMode: 'semantic',
          inputVar: 'user_message',
          routes: [
            { id: 'r1', label: 'Technical Issue' },
            { id: 'r2', label: 'Billing & Invoice' },
          ],
          fallbackRoute: 'General Inquiries',
        }),
        ...(type === 'condition' && {
          conditionExpr: 'confidence >= 0.80',
          trueBranchLabel: 'TRUE',
          falseBranchLabel: 'FALSE',
        }),
        ...(type === 'tool' && {
          toolType: 'web_search',
          description: 'Search the live web for real-time information.',
        }),
        ...(type === 'api_request' && {
          apiMethod: 'POST',
          apiUrl: 'https://api.example.com/v1/webhook',
          apiHeaders: '{\n  "Content-Type": "application/json"\n}',
          apiBody: '{\n  "query": "{{user_message}}"\n}',
        }),
        ...(type === 'rag' && {
          ragCollection: 'company_documentation',
          queryTemplate: '{user_message}',
          topK: 3,
          similarityThreshold: 0.75,
        }),
        ...(type === 'guardrail' && {
          guardrailRules: ['injection', 'pii', 'toxic'],
          moderationAction: 'block',
        }),
        ...(type === 'memory' && {
          stateAction: 'read',
          stateKey: 'user_profile',
        }),
        ...(type === 'transform' && {
          transformCode: 'return { output: input.text.trim() };',
        }),
        ...(type === 'human' && {
          approvalPrompt: 'Please review and approve this action.',
          timeoutMinutes: 60,
          timeoutAction: 'escalate',
        }),
        ...(type === 'end' && {
          endResponseTemplate: '{{agent_output}}',
          endDeliveryType: 'chat_message',
        }),
      },
    };

    setGraph((prev) => ({
      ...prev,
      nodes: [...prev.nodes, newNode],
    }));
    setSelectedNodeId(newId);
    setSelectedEdgeId(null);
  };

  const handleDeleteNode = (nodeId: string) => {
    setGraph((prev) => ({
      ...prev,
      nodes: prev.nodes.filter((n) => n.id !== nodeId),
      edges: prev.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    }));
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
  };

  const handleDeleteSelected = () => {
    if (selectedNodeId) {
      handleDeleteNode(selectedNodeId);
    } else if (selectedEdgeId) {
      setGraph((prev) => ({
        ...prev,
        edges: prev.edges.filter((e) => e.id !== selectedEdgeId),
      }));
      setSelectedEdgeId(null);
    }
  };

  // Connect Nodes
  const handleConnectNodes = (sourceId: string, targetId: string) => {
    setIsConnectingFrom(null);
    if (!sourceId || !targetId || sourceId === targetId) return;

    // Check if edge already exists
    const exists = graph.edges.some((e) => e.source === sourceId && e.target === targetId);
    if (exists) return;

    const sourceNode = graph.nodes.find((n) => n.id === sourceId);
    let edgeLabel: string | undefined = undefined;

    if (sourceNode?.type === 'classifier') {
      const existingOut = graph.edges.filter((e) => e.source === sourceId);
      const routes = sourceNode.data.routes || [];
      const nextRoute = routes[existingOut.length];
      edgeLabel = nextRoute ? nextRoute.label : `Route ${existingOut.length + 1}`;
    } else if (sourceNode?.type === 'condition') {
      const existingOut = graph.edges.filter((e) => e.source === sourceId);
      edgeLabel = existingOut.length === 0 ? 'TRUE' : 'FALSE';
    }

    const newEdge: WorkflowEdge = {
      id: `e-${sourceId}-${targetId}-${Date.now().toString().slice(-4)}`,
      source: sourceId,
      target: targetId,
      label: edgeLabel,
    };

    setGraph((prev) => ({
      ...prev,
      edges: [...prev.edges, newEdge],
    }));
  };

  // Virtual Coordinate Drag & Pan
  const handleNodeMouseDown = (e: MouseEvent, nodeId: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
    draggingNodeIdRef.current = nodeId;

    const targetNode = graph.nodes.find((n) => n.id === nodeId);
    if (targetNode && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const virtualX = (e.clientX - rect.left - pan.x) / zoom;
      const virtualY = (e.clientY - rect.top - pan.y) / zoom;
      dragOffsetRef.current = {
        x: virtualX - targetNode.position.x,
        y: virtualY - targetNode.position.y,
      };
    }
  };

  const handleCanvasMouseDown = (e: MouseEvent) => {
    if (e.button === 0 || e.button === 1) {
      isPanningRef.current = true;
      panStartRef.current = {
        x: e.clientX - pan.x,
        y: e.clientY - pan.y,
      };
    }
  };

  const handleCanvasMouseMove = (e: MouseEvent) => {
    if (draggingNodeIdRef.current && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const virtualX = (e.clientX - rect.left - pan.x) / zoom;
      const virtualY = (e.clientY - rect.top - pan.y) / zoom;
      const newX = Math.round(virtualX - dragOffsetRef.current.x);
      const newY = Math.round(virtualY - dragOffsetRef.current.y);

      setGraph((prev) => ({
        ...prev,
        nodes: prev.nodes.map((node) =>
          node.id === draggingNodeIdRef.current
            ? { ...node, position: { x: newX, y: newY } }
            : node,
        ),
      }));
    } else if (isPanningRef.current) {
      setPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      });
    }
  };

  const handleCanvasMouseUp = () => {
    draggingNodeIdRef.current = null;
    isPanningRef.current = false;
  };

  const handleCanvasWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const zoomDelta = -e.deltaY * 0.0015;
      const newZoom = Math.min(2.0, Math.max(0.4, zoom + zoomDelta));
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const scaleChange = newZoom / zoom;
        setPan({
          x: mouseX - (mouseX - pan.x) * scaleChange,
          y: mouseY - (mouseY - pan.y) * scaleChange,
        });
      }
      setZoom(newZoom);
    } else {
      setPan((prev) => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      const isInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement;

      if (e.key === 'Escape') {
        setIsConnectingFrom(null);
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setIsJsonModalOpen(false);
        return;
      }

      if (isInput) return;

      if ((e.key === 'Delete' || e.key === 'Backspace') && !isInput) {
        handleDeleteSelected();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (selectedNodeId) {
          handleDuplicateNode(selectedNodeId);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveWorkflow();
      } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        handleFitView();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, selectedEdgeId, graph]);

  // AI Copilot Prompt Handling
  const handleSendMessage = () => {
    if (!chatInput.trim() || isAiGenerating) return;
    const userPrompt = chatInput.trim();
    setChatInput('');

    const newMsg = {
      id: `m-${Date.now()}`,
      role: 'user' as const,
      content: userPrompt,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMsg]);
    setIsAiGenerating(true);

    setTimeout(() => {
      let suggested: WorkflowGraph | undefined = undefined;
      let reply = '';

      const lower = userPrompt.toLowerCase();
      if (lower.includes('rag') || lower.includes('search') || lower.includes('docs')) {
        suggested = TEMPLATES.rag_researcher.graph;
        reply =
          'Generated a 4-node RAG Research & Synthesis pipeline using Vector Knowledge Retrieval and a GPT-4o synthesis agent.';
      } else if (lower.includes('guard') || lower.includes('safe') || lower.includes('moderation')) {
        suggested = TEMPLATES.safety_guardrail.graph;
        reply =
          'Generated a Safety Guardrailed Pipeline featuring prompt injection filtering, session memory storage, and agent loop.';
      } else {
        suggested = TEMPLATES.intent_router.graph;
        reply =
          'Constructed a Multi-Agent Intent Router flow with specialized technical support & billing concierges and human review escalation.';
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `m-bot-${Date.now()}`,
          role: 'assistant',
          content: reply,
          suggestedGraph: suggested,
          timestamp: new Date(),
        },
      ]);
      setIsAiGenerating(false);
    }, 800);
  };

  const handleApplyGraph = (newGraph: WorkflowGraph) => {
    setGraph(newGraph);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setTimeout(() => handleFitView(), 50);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        <div className="flex items-center gap-2.5 text-sm">
          <Loader2 className="size-4 animate-spin text-brand-400" />
          Loading project studio…
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-neutral-950 font-sans text-neutral-100 antialiased select-none">
      {/* ── Top Header Toolbar ────────────────────────────────────────── */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-800 bg-neutral-950/90 px-4 backdrop-blur-md z-30">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-xs font-medium text-neutral-400 no-underline transition-colors hover:border-neutral-700 hover:text-white"
          >
            <ArrowLeft className="size-3.5" />
            Projects
          </Link>

          <div className="h-4 w-px bg-neutral-800" />

          {/* Editable Project Name */}
          {isEditingTitle ? (
            <input
              type="text"
              autoFocus
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
              className="rounded-lg border border-brand-500 bg-neutral-900 px-2.5 py-1 text-sm font-semibold text-white focus:outline-none ring-1 ring-brand-500/50"
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingTitle(true)}
              className="text-sm font-semibold text-white hover:text-brand-400 transition-colors"
              title="Click to rename project"
            >
              {projectName}
            </button>
          )}

          <span className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-neutral-400">
            {graph.status}
          </span>

          {/* Graph Validation Badge */}
          <div
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-mono border ${
              validation.isValid
                ? 'border-emerald-800/40 bg-emerald-950/40 text-emerald-400'
                : 'border-amber-800/40 bg-amber-950/40 text-amber-400'
            }`}
            title={validation.issues.join('\n') || 'All nodes properly connected for LangGraph compilation'}
          >
            <span
              className={`size-1.5 rounded-full ${
                validation.isValid ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
              }`}
            />
            <span>{validation.isValid ? 'LangGraph Valid' : `${validation.issues.length} warnings`}</span>
          </div>
        </div>

        {/* Center Quick Add Palette */}
        <div className="hidden items-center gap-1 rounded-xl border border-neutral-800 bg-neutral-900/80 p-1 lg:flex shadow-xs">
          <button
            type="button"
            onClick={() => handleAddNode('classifier')}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
            title="Semantic Intent Classifier"
          >
            <Split className="size-3.5 text-sky-400" />
            + Router
          </button>
          <button
            type="button"
            onClick={() => handleAddNode('agent')}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
            title="Autonomous ReAct Agent"
          >
            <Bot className="size-3.5 text-brand-400" />
            + Agent
          </button>
          <button
            type="button"
            onClick={() => handleAddNode('llm')}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
            title="Single-pass LLM Inference"
          >
            <Cpu className="size-3.5 text-purple-400" />
            + LLM
          </button>
          <button
            type="button"
            onClick={() => handleAddNode('rag')}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
            title="Vector Knowledge Base Retrieval"
          >
            <Database className="size-3.5 text-cyan-400" />
            + RAG
          </button>
          <button
            type="button"
            onClick={() => handleAddNode('tool')}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
            title="External Tool Integration"
          >
            <Wrench className="size-3.5 text-amber-400" />
            + Tool
          </button>
          <button
            type="button"
            onClick={() => handleAddNode('condition')}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
            title="Boolean Condition Branch"
          >
            <GitFork className="size-3.5 text-orange-400" />
            + Rule
          </button>
          <button
            type="button"
            onClick={() => handleAddNode('human')}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
            title="Human in the loop approval gate"
          >
            <UserCheck className="size-3.5 text-pink-400" />
            + Human
          </button>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Fit View Shortcut */}
          <button
            type="button"
            onClick={handleFitView}
            className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-xs font-medium text-neutral-400 hover:border-neutral-700 hover:text-white transition-colors"
            title="Fit to View (Ctrl+0)"
          >
            <Maximize2 className="size-3.5" />
            Fit
          </button>

          {/* JSON Graph Spec Modal */}
          <button
            type="button"
            onClick={() => setIsJsonModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-300 transition-colors hover:border-neutral-700 hover:text-white"
          >
            <Code2 className="size-3.5 text-brand-400" />
            LangGraph JSON
          </button>

          {/* AI Copilot Drawer Toggle */}
          <button
            type="button"
            onClick={() => setIsCopilotOpen((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              isCopilotOpen
                ? 'bg-brand-600 text-white shadow-brand-500/20 shadow-md'
                : 'border border-neutral-800 bg-neutral-900 text-neutral-300 hover:bg-neutral-800'
            }`}
          >
            <Sparkles className="size-3.5" />
            AI Copilot
          </button>

          {/* Save Workflow to Backend */}
          <button
            type="button"
            onClick={handleSaveWorkflow}
            disabled={saveStatus === 'saving'}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-1.5 text-xs font-semibold text-neutral-950 shadow-sm transition-all hover:bg-neutral-200 disabled:opacity-50"
            title="Save workflow (Ctrl+S)"
          >
            {saveStatus === 'saving' ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Saving…
              </>
            ) : saveStatus === 'saved' ? (
              <>
                <Check className="size-3.5 text-emerald-600" />
                Saved!
              </>
            ) : (
              <>
                <Save className="size-3.5" />
                Save
              </>
            )}
          </button>
        </div>
      </header>

      {/* ── Main Workspace Body ────────────────────────────────────────── */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* ── Left Collapsible Node Palette ────────────────────────────── */}
        <aside
          className={`shrink-0 border-r border-neutral-800 bg-neutral-950/80 backdrop-blur-md transition-all duration-200 flex flex-col z-20 ${
            isLeftSidebarOpen ? 'w-64' : 'w-12'
          }`}
        >
          {/* Palette Header */}
          <div className="flex h-10 items-center justify-between border-b border-neutral-800/80 px-3">
            {isLeftSidebarOpen && (
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                Node Library
              </span>
            )}
            <button
              type="button"
              onClick={() => setIsLeftSidebarOpen((v) => !v)}
              className="flex size-7 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-800 hover:text-white"
              title={isLeftSidebarOpen ? 'Collapse library' : 'Expand library'}
            >
              <Layers className="size-3.5" />
            </button>
          </div>

          {/* Palette Categorized Items */}
          <div className="flex-1 overflow-y-auto p-2 space-y-4">
            {PALETTE_CATEGORIES.map((category) => (
              <div key={category.name} className="space-y-1">
                {isLeftSidebarOpen && (
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                    {category.name}
                  </div>
                )}
                {category.items.map((item) => {
                  const meta = getNodeMeta(item.type);
                  return (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => handleAddNode(item.type)}
                      title={item.desc}
                      className={`w-full flex items-center gap-2.5 rounded-lg border border-neutral-800/80 bg-neutral-900/50 p-2 text-left transition-all hover:border-neutral-700 hover:bg-neutral-800/70 group ${
                        !isLeftSidebarOpen ? 'justify-center p-2.5' : ''
                      }`}
                    >
                      <div className="size-6 shrink-0 rounded-md bg-neutral-800/80 flex items-center justify-center group-hover:scale-105 transition-transform">
                        {meta.icon}
                      </div>
                      {isLeftSidebarOpen && (
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-neutral-200 group-hover:text-white truncate">
                            {item.title}
                          </div>
                          <div className="text-[10px] text-neutral-400 truncate">
                            {item.desc}
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </aside>

        {/* ── Main Virtual Canvas ──────────────────────────────────────── */}
        <div
          ref={canvasRef}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onWheel={handleCanvasWheel}
          onClick={() => {
            if (isConnectingFrom) {
              setIsConnectingFrom(null);
            } else {
              setSelectedNodeId(null);
              setSelectedEdgeId(null);
            }
          }}
          className="relative flex-1 select-none overflow-hidden bg-[#090b0e] cursor-grab active:cursor-grabbing"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.08) 1.2px, transparent 1.2px)',
            backgroundPosition: `${pan.x}px ${pan.y}px`,
            backgroundSize: `${26 * zoom}px ${26 * zoom}px`,
          }}
        >
          {/* Active Connection Notice Banner */}
          {isConnectingFrom && (
            <div className="absolute top-4 left-1/2 z-30 -translate-x-1/2 rounded-full border border-sky-500/50 bg-sky-950/90 px-4 py-1.5 text-xs font-medium text-sky-200 shadow-xl backdrop-blur-md flex items-center gap-2">
              <span className="size-2 rounded-full bg-sky-400 animate-ping" />
              <span>
                Connecting from <strong className="text-white underline">{isConnectingFrom}</strong>
              </span>
              <span className="text-neutral-400">· Click any target node to link (Esc to cancel)</span>
            </div>
          )}

          {/* Virtual Scaled Canvas Container */}
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              position: 'absolute',
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
          >
            {/* SVG Connecting Bezier Edges */}
            <svg className="pointer-events-none absolute inset-0 size-full overflow-visible">
              <defs>
                <marker
                  id="arrow-default"
                  viewBox="0 0 10 10"
                  refX="7"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#64748b" />
                </marker>
                <marker
                  id="arrow-selected"
                  viewBox="0 0 10 10"
                  refX="7"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#38bdf8" />
                </marker>
              </defs>

              {graph.edges.map((edge) => {
                const srcNode = graph.nodes.find((n) => n.id === edge.source);
                const tgtNode = graph.nodes.find((n) => n.id === edge.target);
                if (!srcNode || !tgtNode) return null;

                const isSelected = selectedEdgeId === edge.id;
                const isConditional =
                  Boolean(edge.label) || srcNode.type === 'classifier' || srcNode.type === 'condition';

                const sx = srcNode.position.x + NODE_WIDTH / 2;
                const sy = srcNode.position.y + NODE_HEIGHT;
                const tx = tgtNode.position.x + NODE_WIDTH / 2;
                const ty = tgtNode.position.y;

                const deltaY = Math.max(35, Math.abs(ty - sy) * 0.45);
                const pathD = `M ${sx} ${sy} C ${sx} ${sy + deltaY}, ${tx} ${ty - deltaY}, ${tx} ${ty}`;
                const midX = (sx + tx) / 2;
                const midY = (sy + ty) / 2;

                return (
                  <g key={edge.id} className="pointer-events-auto">
                    {/* Wider transparent hit-test line for easy selection */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={20}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEdgeId(edge.id);
                        setSelectedNodeId(null);
                      }}
                      className="cursor-pointer"
                    />

                    {/* Visible Bezier Curve */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke={isSelected ? '#38bdf8' : isConditional ? '#38bdf8' : '#52525b'}
                      strokeWidth={isSelected ? 2.5 : 1.75}
                      strokeDasharray={isConditional ? '6 4' : undefined}
                      markerEnd={isSelected ? 'url(#arrow-selected)' : 'url(#arrow-default)'}
                      className="transition-colors cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEdgeId(edge.id);
                        setSelectedNodeId(null);
                      }}
                    />

                    {/* Route Label Pill */}
                    {edge.label && (
                      <foreignObject
                        x={midX - 75}
                        y={midY - 13}
                        width={150}
                        height={26}
                        className="pointer-events-none overflow-visible"
                      >
                        <div className="flex justify-center">
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEdgeId(edge.id);
                            }}
                            className={`pointer-events-auto cursor-pointer rounded-full border px-2 py-0.5 text-[9px] font-mono tracking-wider shadow-lg transition-all ${
                              isSelected
                                ? 'border-sky-400 bg-sky-950 text-sky-200 ring-2 ring-sky-400/40'
                                : 'border-neutral-700 bg-neutral-900/90 text-neutral-300 hover:border-neutral-500'
                            }`}
                          >
                            {edge.label}
                          </span>
                        </div>
                      </foreignObject>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Interactive Graph Node Cards */}
            {graph.nodes.map((node) => {
              const isSelected = selectedNodeId === node.id;
              const isConnecting = isConnectingFrom === node.id;
              const meta = getNodeMeta(node.type);

              return (
                <div
                  key={node.id}
                  onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isConnectingFrom && isConnectingFrom !== node.id) {
                      handleConnectNodes(isConnectingFrom, node.id);
                    } else {
                      setSelectedNodeId(node.id);
                      setSelectedEdgeId(null);
                    }
                  }}
                  style={{
                    transform: `translate(${node.position.x}px, ${node.position.y}px)`,
                    width: `${NODE_WIDTH}px`,
                  }}
                  className={`group pointer-events-auto absolute rounded-xl border p-3 shadow-xl transition-all cursor-move select-none ${
                    isSelected
                      ? 'border-brand-400 bg-neutral-900 ring-2 ring-brand-400/40 shadow-brand-500/10'
                      : isConnecting
                      ? 'border-sky-400 bg-neutral-900 ring-2 ring-sky-400/30'
                      : 'border-neutral-800 bg-neutral-950/95 hover:border-neutral-700'
                  }`}
                >
                  {/* Top Target Handle Dot */}
                  <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 size-3 rounded-full border border-neutral-700 bg-neutral-900 flex items-center justify-center">
                    <div
                      className={`size-1.5 rounded-full ${
                        isConnectingFrom && isConnectingFrom !== node.id
                          ? 'bg-sky-400 animate-ping'
                          : 'bg-neutral-500'
                      }`}
                    />
                  </div>

                  {/* Header Row: Badge + Quick Hover Action Buttons */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {meta.icon}
                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider ${meta.badge}`}>
                        {node.data.sublabel || node.type}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        title="Duplicate node (Ctrl+D)"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicateNode(node.id);
                        }}
                        className="size-5 rounded flex items-center justify-center text-neutral-400 hover:bg-neutral-800 hover:text-white"
                      >
                        <Copy className="size-3" />
                      </button>
                      <button
                        type="button"
                        title="Delete node (Del)"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteNode(node.id);
                        }}
                        className="size-5 rounded flex items-center justify-center text-neutral-400 hover:bg-red-950/50 hover:text-red-400"
                      >
                        <Trash2 className="size-3" />
                      </button>
                      <button
                        type="button"
                        title="Connect edge..."
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsConnectingFrom(node.id);
                        }}
                        className="size-5 rounded-full bg-brand-600 flex items-center justify-center text-white hover:bg-brand-500 shadow-xs"
                      >
                        <Plus className="size-3" />
                      </button>
                    </div>
                  </div>

                  {/* Node Title */}
                  <div className="mt-1.5 text-xs font-semibold text-white truncate">
                    {node.title}
                  </div>

                  {/* Node Metadata / Parameters Preview */}
                  <div className="mt-0.5 text-[10px] font-mono text-neutral-400 truncate">
                    {node.type === 'agent' && (node.data.model || 'Autonomous ReAct')}
                    {node.type === 'llm' && `${node.data.model || 'gpt-4o-mini'} · ${node.data.responseFormat || 'text'}`}
                    {node.type === 'classifier' &&
                      `${node.data.routes?.length || 0} routes · ${node.data.classifierMode || 'semantic'}`}
                    {node.type === 'condition' && (node.data.conditionExpr || 'IF / ELSE branch')}
                    {node.type === 'rag' &&
                      `${node.data.ragCollection || 'knowledge_base'} (topK: ${node.data.topK || 3})`}
                    {node.type === 'tool' && (node.data.toolType || 'web_search')}
                    {node.type === 'api_request' && `${node.data.apiMethod || 'POST'} ${node.data.apiUrl || ''}`}
                    {node.type === 'guardrail' && (node.data.guardrailRules?.join(', ') || 'Safety filters')}
                    {node.type === 'memory' && `${node.data.stateAction || 'read'} -> ${node.data.stateKey || 'session'}`}
                    {node.type === 'human' && `Timeout: ${node.data.timeoutMinutes || 60}m`}
                    {node.type === 'start' && `${node.data.inputParams?.length || 0} input parameters`}
                    {node.type === 'end' && (node.data.endDeliveryType || 'chat_message')}
                    {node.type === 'transform' && 'Code transformation'}
                  </div>

                  {/* Bottom Source Handle Button */}
                  <button
                    type="button"
                    title="Click to connect edge"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsConnectingFrom(node.id);
                    }}
                    className="absolute -bottom-2 left-1/2 -translate-x-1/2 size-4 rounded-full border border-neutral-700 bg-neutral-900 hover:border-brand-400 hover:bg-brand-600 text-neutral-400 hover:text-white flex items-center justify-center transition-colors shadow-xs"
                  >
                    <Plus className="size-2.5" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Floating Canvas Controls (Bottom-Left) */}
          <div className="absolute bottom-5 left-5 z-20 flex items-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-950/90 p-1 backdrop-blur-md shadow-xl">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.1).toFixed(2))))}
              className="flex size-7 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
              title="Zoom out"
            >
              <Minus className="size-3.5" />
            </button>
            <span className="px-1.5 font-mono text-xs text-neutral-300 min-w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(2.0, Number((z + 0.1).toFixed(2))))}
              className="flex size-7 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
              title="Zoom in"
            >
              <Plus className="size-3.5" />
            </button>
            <div className="h-4 w-px bg-neutral-800" />
            <button
              type="button"
              onClick={() => {
                setZoom(1.0);
                setPan({ x: 140, y: 50 });
              }}
              className="flex size-7 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
              title="Reset 100%"
            >
              <RefreshCw className="size-3" />
            </button>
            <button
              type="button"
              onClick={handleFitView}
              className="flex size-7 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
              title="Fit View (Ctrl+0)"
            >
              <Maximize2 className="size-3.5" />
            </button>
            {(selectedNodeId || selectedEdgeId) && (
              <>
                <div className="h-4 w-px bg-neutral-800" />
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  className="flex size-7 items-center justify-center rounded-lg text-red-400 hover:bg-red-950/60 hover:text-red-300 transition-colors"
                  title="Delete Selected (Del)"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Node Properties Inspector Drawer ────────────────────────── */}
        {selectedNode && isInspectorOpen && (
          <aside className="w-80 shrink-0 border-l border-neutral-800 bg-neutral-950 p-4 text-xs overflow-y-auto flex flex-col z-20">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <Sliders className="size-4 text-brand-400" />
                <span className="font-semibold text-white">Node Inspector</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  title="Duplicate Node (Ctrl+D)"
                  onClick={() => handleDuplicateNode(selectedNode.id)}
                  className="rounded p-1 text-neutral-400 hover:bg-neutral-800 hover:text-white"
                >
                  <Copy className="size-3.5" />
                </button>
                <button
                  type="button"
                  title="Delete Node (Del)"
                  onClick={() => handleDeleteNode(selectedNode.id)}
                  className="rounded p-1 text-neutral-400 hover:bg-red-950/50 hover:text-red-400"
                >
                  <Trash2 className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedNodeId(null)}
                  className="rounded p-1 text-neutral-400 hover:text-white"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* General Properties */}
            <div className="mt-4 space-y-3.5">
              <InputField
                label="Node Title"
                value={selectedNode.title}
                onChange={(val) => {
                  setGraph((prev) => ({
                    ...prev,
                    nodes: prev.nodes.map((n) =>
                      n.id === selectedNode.id ? { ...n, title: val, data: { ...n.data, label: val } } : n,
                    ),
                  }));
                }}
              />

              <InputField
                label="Sublabel / Category Tag"
                value={selectedNode.data.sublabel || ''}
                onChange={(val) => {
                  setGraph((prev) => ({
                    ...prev,
                    nodes: prev.nodes.map((n) =>
                      n.id === selectedNode.id ? { ...n, data: { ...n.data, sublabel: val } } : n,
                    ),
                  }));
                }}
              />

              <InputField
                label="Output State Variable"
                value={selectedNode.data.outputVar || ''}
                fontMono
                placeholder="e.g. tech_solution"
                onChange={(val) => {
                  setGraph((prev) => ({
                    ...prev,
                    nodes: prev.nodes.map((n) =>
                      n.id === selectedNode.id ? { ...n, data: { ...n.data, outputVar: val } } : n,
                    ),
                  }));
                }}
              />

              <div className="h-px bg-neutral-800/80 my-2" />

              {/* Start Trigger Node */}
              {selectedNode.type === 'start' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-300">
                    <span>Input Parameters</span>
                    <button
                      type="button"
                      onClick={() => {
                        const newParam: InputParameter = {
                          name: `param_${Date.now().toString().slice(-4)}`,
                          type: 'string',
                          required: true,
                        };
                        setGraph((prev) => ({
                          ...prev,
                          nodes: prev.nodes.map((n) =>
                            n.id === selectedNode.id
                              ? {
                                  ...n,
                                  data: {
                                    ...n.data,
                                    inputParams: [...(n.data.inputParams || []), newParam],
                                  },
                                }
                              : n,
                          ),
                        }));
                      }}
                      className="text-brand-400 hover:text-brand-300 font-mono text-[10px]"
                    >
                      + Add Param
                    </button>
                  </div>

                  {selectedNode.data.inputParams?.map((param, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-2.5 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <input
                          type="text"
                          value={param.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setGraph((prev) => ({
                              ...prev,
                              nodes: prev.nodes.map((n) =>
                                n.id === selectedNode.id
                                  ? {
                                      ...n,
                                      data: {
                                        ...n.data,
                                        inputParams: n.data.inputParams?.map((p, i) =>
                                          i === idx ? { ...p, name: val } : p,
                                        ),
                                      },
                                    }
                                  : n,
                              ),
                            }));
                          }}
                          className="font-mono text-xs text-white bg-transparent border-b border-neutral-700 focus:border-brand-400 focus:outline-none w-32"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setGraph((prev) => ({
                              ...prev,
                              nodes: prev.nodes.map((n) =>
                                n.id === selectedNode.id
                                  ? {
                                      ...n,
                                      data: {
                                        ...n.data,
                                        inputParams: n.data.inputParams?.filter((_, i) => i !== idx),
                                      },
                                    }
                                  : n,
                              ),
                            }));
                          }}
                          className="text-neutral-500 hover:text-red-400 text-xs"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-neutral-400">
                        <select
                          value={param.type}
                          onChange={(e) => {
                            const val = e.target.value as any;
                            setGraph((prev) => ({
                              ...prev,
                              nodes: prev.nodes.map((n) =>
                                n.id === selectedNode.id
                                  ? {
                                      ...n,
                                      data: {
                                        ...n.data,
                                        inputParams: n.data.inputParams?.map((p, i) =>
                                          i === idx ? { ...p, type: val } : p,
                                        ),
                                      },
                                    }
                                  : n,
                              ),
                            }));
                          }}
                          className="rounded border border-neutral-800 bg-neutral-900 px-1.5 py-0.5 text-xs text-white"
                        >
                          <option value="string">string</option>
                          <option value="number">number</option>
                          <option value="boolean">boolean</option>
                          <option value="json">json</option>
                        </select>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={param.required}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setGraph((prev) => ({
                                ...prev,
                                nodes: prev.nodes.map((n) =>
                                  n.id === selectedNode.id
                                    ? {
                                        ...n,
                                        data: {
                                          ...n.data,
                                          inputParams: n.data.inputParams?.map((p, i) =>
                                            i === idx ? { ...p, required: checked } : p,
                                          ),
                                        },
                                      }
                                    : n,
                                ),
                              }));
                            }}
                            className="accent-brand-500 rounded"
                          />
                          <span>Required</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Agent Node */}
              {selectedNode.type === 'agent' && (
                <div className="space-y-3">
                  <SelectField
                    label="Model Selection"
                    value={selectedNode.data.model || 'gpt-4o-mini'}
                    onChange={(val) => {
                      setGraph((prev) => ({
                        ...prev,
                        nodes: prev.nodes.map((n) =>
                          n.id === selectedNode.id ? { ...n, data: { ...n.data, model: val } } : n,
                        ),
                      }));
                    }}
                    options={[
                      { label: 'GPT-4o Mini (Default)', value: 'gpt-4o-mini' },
                      { label: 'GPT-4o (High Intelligence)', value: 'gpt-4o' },
                      { label: 'Claude 3.5 Sonnet (Advanced Reasoning)', value: 'claude-3-5-sonnet' },
                      { label: 'Claude 3.5 Haiku (Fast)', value: 'claude-3-5-haiku' },
                      { label: 'Gemini 1.5 Pro (Long Context)', value: 'gemini-1.5-pro' },
                      { label: 'Llama 3.3 70B (Open Source)', value: 'llama-3.3-70b' },
                    ]}
                  />

                  <SliderField
                    label="Temperature"
                    value={selectedNode.data.temperature ?? 0.3}
                    min={0.0}
                    max={1.0}
                    step={0.05}
                    onChange={(val) => {
                      setGraph((prev) => ({
                        ...prev,
                        nodes: prev.nodes.map((n) =>
                          n.id === selectedNode.id ? { ...n, data: { ...n.data, temperature: val } } : n,
                        ),
                      }));
                    }}
                  />

                  <SliderField
                    label="Max ReAct Iteration Steps"
                    value={selectedNode.data.maxSteps ?? 5}
                    min={1}
                    max={20}
                    step={1}
                    onChange={(val) => {
                      setGraph((prev) => ({
                        ...prev,
                        nodes: prev.nodes.map((n) =>
                          n.id === selectedNode.id ? { ...n, data: { ...n.data, maxSteps: val } } : n,
                        ),
                      }));
                    }}
                  />

                  <div>
                    <label className="block text-[11px] font-medium text-neutral-400 mb-1.5">
                      Attached Tools
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: 'web_search', label: 'Web Search' },
                        { id: 'knowledge_base', label: 'Knowledge Base' },
                        { id: 'custom_api', label: 'Custom API' },
                        { id: 'code_exec', label: 'Code Exec' },
                      ].map((t) => {
                        const hasTool = selectedNode.data.tools?.includes(t.id);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              const current = selectedNode.data.tools || [];
                              const updated = hasTool
                                ? current.filter((x) => x !== t.id)
                                : [...current, t.id];
                              setGraph((prev) => ({
                                ...prev,
                                nodes: prev.nodes.map((n) =>
                                  n.id === selectedNode.id
                                    ? { ...n, data: { ...n.data, tools: updated } }
                                    : n,
                                ),
                              }));
                            }}
                            className={`rounded-lg border px-2 py-1.5 text-[11px] font-medium text-left transition-colors ${
                              hasTool
                                ? 'border-brand-500 bg-brand-950/40 text-brand-300'
                                : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white'
                            }`}
                          >
                            {hasTool ? '✓ ' : '+ '}
                            {t.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <SelectField
                    label="Memory Type"
                    value={selectedNode.data.memoryType || 'buffer'}
                    onChange={(val) => {
                      setGraph((prev) => ({
                        ...prev,
                        nodes: prev.nodes.map((n) =>
                          n.id === selectedNode.id ? { ...n, data: { ...n.data, memoryType: val as any } } : n,
                        ),
                      }));
                    }}
                    options={[
                      { label: 'Window Buffer Memory', value: 'buffer' },
                      { label: 'Conversation Summary Memory', value: 'summary' },
                      { label: 'Vector Store Memory', value: 'vector' },
                      { label: 'Stateless (None)', value: 'none' },
                    ]}
                  />

                  <TextareaField
                    label="Agent System Prompt"
                    value={selectedNode.data.systemPrompt || ''}
                    placeholder="Define the agent persona, role, and execution boundaries..."
                    rows={4}
                    onChange={(val) => {
                      setGraph((prev) => ({
                        ...prev,
                        nodes: prev.nodes.map((n) =>
                          n.id === selectedNode.id ? { ...n, data: { ...n.data, systemPrompt: val } } : n,
                        ),
                      }));
                    }}
                  />
                </div>
              )}

              {/* LLM Single-Pass Node */}
              {selectedNode.type === 'llm' && (
                <div className="space-y-3">
                  <SelectField
                    label="Model"
                    value={selectedNode.data.model || 'gpt-4o-mini'}
                    onChange={(val) => {
                      setGraph((prev) => ({
                        ...prev,
                        nodes: prev.nodes.map((n) =>
                          n.id === selectedNode.id ? { ...n, data: { ...n.data, model: val } } : n,
                        ),
                      }));
                    }}
                    options={[
                      { label: 'GPT-4o Mini', value: 'gpt-4o-mini' },
                      { label: 'GPT-4o', value: 'gpt-4o' },
                      { label: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet' },
                    ]}
                  />

                  <SelectField
                    label="Response Format"
                    value={selectedNode.data.responseFormat || 'text'}
                    onChange={(val) => {
                      setGraph((prev) => ({
                        ...prev,
                        nodes: prev.nodes.map((n) =>
                          n.id === selectedNode.id
                            ? { ...n, data: { ...n.data, responseFormat: val as any } }
                            : n,
                        ),
                      }));
                    }}
                    options={[
                      { label: 'Plain Text', value: 'text' },
                      { label: 'JSON Object Schema', value: 'json_object' },
                    ]}
                  />

                  <TextareaField
                    label="User Prompt Template"
                    value={selectedNode.data.userPrompt || ''}
                    placeholder="e.g. Summarize: {user_message}"
                    rows={3}
                    fontMono
                    onChange={(val) => {
                      setGraph((prev) => ({
                        ...prev,
                        nodes: prev.nodes.map((n) =>
                          n.id === selectedNode.id ? { ...n, data: { ...n.data, userPrompt: val } } : n,
                        ),
                      }));
                    }}
                  />
                </div>
              )}

              {/* Intent Classifier Node */}
              {selectedNode.type === 'classifier' && (
                <div className="space-y-3">
                  <SelectField
                    label="Classifier Mode"
                    value={selectedNode.data.classifierMode || 'semantic'}
                    onChange={(val) => {
                      setGraph((prev) => ({
                        ...prev,
                        nodes: prev.nodes.map((n) =>
                          n.id === selectedNode.id
                            ? { ...n, data: { ...n.data, classifierMode: val as any } }
                            : n,
                        ),
                      }));
                    }}
                    options={[
                      { label: 'Semantic Embeddings', value: 'semantic' },
                      { label: 'Zero-shot LLM Prompt', value: 'llm' },
                      { label: 'Regex Pattern Match', value: 'regex' },
                    ]}
                  />

                  <InputField
                    label="Input Variable to Classify"
                    value={selectedNode.data.inputVar || 'user_message'}
                    fontMono
                    onChange={(val) => {
                      setGraph((prev) => ({
                        ...prev,
                        nodes: prev.nodes.map((n) =>
                          n.id === selectedNode.id ? { ...n, data: { ...n.data, inputVar: val } } : n,
                        ),
                      }));
                    }}
                  />

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-300">
                      <span>Configured Routes</span>
                      <button
                        type="button"
                        onClick={() => {
                          const newRoute: RouteOption = {
                            id: `r-${Date.now().toString().slice(-4)}`,
                            label: `New Route ${(selectedNode.data.routes?.length || 0) + 1}`,
                          };
                          setGraph((prev) => ({
                            ...prev,
                            nodes: prev.nodes.map((n) =>
                              n.id === selectedNode.id
                                ? {
                                    ...n,
                                    data: {
                                      ...n.data,
                                      routes: [...(n.data.routes || []), newRoute],
                                    },
                                  }
                                : n,
                            ),
                          }));
                        }}
                        className="text-brand-400 hover:text-brand-300 font-mono text-[10px]"
                      >
                        + Add Route
                      </button>
                    </div>

                    {selectedNode.data.routes?.map((route, rIdx) => (
                      <div
                        key={route.id}
                        className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/60 p-2"
                      >
                        <input
                          type="text"
                          value={route.label}
                          onChange={(e) => {
                            const val = e.target.value;
                            setGraph((prev) => ({
                              ...prev,
                              nodes: prev.nodes.map((n) =>
                                n.id === selectedNode.id
                                  ? {
                                      ...n,
                                      data: {
                                        ...n.data,
                                        routes: n.data.routes?.map((r, i) =>
                                          i === rIdx ? { ...r, label: val } : r,
                                        ),
                                      },
                                    }
                                  : n,
                              ),
                            }));
                          }}
                          className="flex-1 bg-transparent text-xs text-white focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setGraph((prev) => ({
                              ...prev,
                              nodes: prev.nodes.map((n) =>
                                n.id === selectedNode.id
                                  ? {
                                      ...n,
                                      data: {
                                        ...n.data,
                                        routes: n.data.routes?.filter((_, i) => i !== rIdx),
                                      },
                                    }
                                  : n,
                              ),
                            }));
                          }}
                          className="text-neutral-500 hover:text-red-400 text-xs px-1"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

                  <InputField
                    label="Fallback Route"
                    value={selectedNode.data.fallbackRoute || 'General Inquiries'}
                    onChange={(val) => {
                      setGraph((prev) => ({
                        ...prev,
                        nodes: prev.nodes.map((n) =>
                          n.id === selectedNode.id ? { ...n, data: { ...n.data, fallbackRoute: val } } : n,
                        ),
                      }));
                    }}
                  />
                </div>
              )}

              {/* Condition Rule Node */}
              {selectedNode.type === 'condition' && (
                <div className="space-y-3">
                  <InputField
                    label="Condition Expression (JavaScript / Python)"
                    value={selectedNode.data.conditionExpr || 'confidence >= 0.80'}
                    fontMono
                    placeholder="e.g. score >= 0.8"
                    onChange={(val) => {
                      setGraph((prev) => ({
                        ...prev,
                        nodes: prev.nodes.map((n) =>
                          n.id === selectedNode.id ? { ...n, data: { ...n.data, conditionExpr: val } } : n,
                        ),
                      }));
                    }}
                  />

                  <InputField
                    label="True Branch Label"
                    value={selectedNode.data.trueBranchLabel || 'TRUE'}
                    onChange={(val) => {
                      setGraph((prev) => ({
                        ...prev,
                        nodes: prev.nodes.map((n) =>
                          n.id === selectedNode.id ? { ...n, data: { ...n.data, trueBranchLabel: val } } : n,
                        ),
                      }));
                    }}
                  />

                  <InputField
                    label="False Branch Label"
                    value={selectedNode.data.falseBranchLabel || 'FALSE'}
                    onChange={(val) => {
                      setGraph((prev) => ({
                        ...prev,
                        nodes: prev.nodes.map((n) =>
                          n.id === selectedNode.id ? { ...n, data: { ...n.data, falseBranchLabel: val } } : n,
                        ),
                      }));
                    }}
                  />
                </div>
              )}

              {/* RAG Knowledge Base Node */}
              {selectedNode.type === 'rag' && (
                <div className="space-y-3">
                  <InputField
                    label="Vector Collection Name"
                    value={selectedNode.data.ragCollection || 'company_documentation'}
                    fontMono
                    onChange={(val) => {
                      setGraph((prev) => ({
                        ...prev,
                        nodes: prev.nodes.map((n) =>
                          n.id === selectedNode.id ? { ...n, data: { ...n.data, ragCollection: val } } : n,
                        ),
                      }));
                    }}
                  />

                  <InputField
                    label="Query Template"
                    value={selectedNode.data.queryTemplate || '{user_message}'}
                    fontMono
                    onChange={(val) => {
                      setGraph((prev) => ({
                        ...prev,
                        nodes: prev.nodes.map((n) =>
                          n.id === selectedNode.id ? { ...n, data: { ...n.data, queryTemplate: val } } : n,
                        ),
                      }));
                    }}
                  />

                  <SliderField
                    label="Top K Documents"
                    value={selectedNode.data.topK ?? 3}
                    min={1}
                    max={10}
                    step={1}
                    onChange={(val) => {
                      setGraph((prev) => ({
                        ...prev,
                        nodes: prev.nodes.map((n) =>
                          n.id === selectedNode.id ? { ...n, data: { ...n.data, topK: val } } : n,
                        ),
                      }));
                    }}
                  />

                  <SliderField
                    label="Similarity Threshold"
                    value={selectedNode.data.similarityThreshold ?? 0.75}
                    min={0.5}
                    max={1.0}
                    step={0.05}
                    onChange={(val) => {
                      setGraph((prev) => ({
                        ...prev,
                        nodes: prev.nodes.map((n) =>
                          n.id === selectedNode.id
                            ? { ...n, data: { ...n.data, similarityThreshold: val } }
                            : n,
                        ),
                      }));
                    }}
                  />
                </div>
              )}

              {/* External Tool Node */}
              {selectedNode.type === 'tool' && (
                <div className="space-y-3">
                  <SelectField
                    label="Tool Type"
                    value={selectedNode.data.toolType || 'web_search'}
                    onChange={(val) => {
                      setGraph((prev) => ({
                        ...prev,
                        nodes: prev.nodes.map((n) =>
                          n.id === selectedNode.id ? { ...n, data: { ...n.data, toolType: val as any } } : n,
                        ),
                      }));
                    }}
                    options={[
                      { label: 'Live Web Search (Tavily/Google)', value: 'web_search' },
                      { label: 'Code Execution Sandbox (Python)', value: 'code_exec' },
                      { label: 'Relational SQL Database', value: 'sql_database' },
                      { label: 'Knowledge Base Vector Search', value: 'knowledge_base' },
                      { label: 'Custom HTTP API Client', value: 'custom_api' },
                    ]}
                  />

                  <TextareaField
                    label="Tool Description"
                    value={selectedNode.data.description || ''}
                    placeholder="Instructions for the agent on how and when to invoke this tool..."
                    rows={3}
                    onChange={(val) => {
                      setGraph((prev) => ({
                        ...prev,
                        nodes: prev.nodes.map((n) =>
                          n.id === selectedNode.id ? { ...n, data: { ...n.data, description: val } } : n,
                        ),
                      }));
                    }}
                  />
                </div>
              )}

              {/* API Request Node */}
              {selectedNode.type === 'api_request' && (
                <div className="space-y-3">
                  <SelectField
                    label="HTTP Method"
                    value={selectedNode.data.apiMethod || 'POST'}
                    onChange={(val) => {
                      setGraph((prev) => ({
                        ...prev,
                        nodes: prev.nodes.map((n) =>
                          n.id === selectedNode.id ? { ...n, data: { ...n.data, apiMethod: val as any } } : n,
                        ),
                      }));
                    }}
                    options={[
                      { label: 'GET', value: 'GET' },
                      { label: 'POST', value: 'POST' },
                      { label: 'PUT', value: 'PUT' },
                      { label: 'DELETE', value: 'DELETE' },
                    ]}
                  />

                  <InputField
                    label="Endpoint URL"
                    value={selectedNode.data.apiUrl || ''}
                    fontMono
                    placeholder="https://api.example.com/webhook"
                    onChange={(val) => {
                      setGraph((prev) => ({
                        ...prev,
                        nodes: prev.nodes.map((n) =>
                          n.id === selectedNode.id ? { ...n, data: { ...n.data, apiUrl: val } } : n,
                        ),
                      }));
                    }}
                  />

                  <TextareaField
                    label="Headers (JSON)"
                    value={selectedNode.data.apiHeaders || ''}
                    rows={2}
                    fontMono
                    onChange={(val) => {
                      setGraph((prev) => ({
                        ...prev,
                        nodes: prev.nodes.map((n) =>
                          n.id === selectedNode.id ? { ...n, data: { ...n.data, apiHeaders: val } } : n,
                        ),
                      }));
                    }}
                  />

                  <TextareaField
                    label="Request Body (JSON)"
                    value={selectedNode.data.apiBody || ''}
                    rows={3}
                    fontMono
                    onChange={(val) => {
                      setGraph((prev) => ({
                        ...prev,
                        nodes: prev.nodes.map((n) =>
                          n.id === selectedNode.id ? { ...n, data: { ...n.data, apiBody: val } } : n,
                        ),
                      }));
                    }}
                  />
                </div>
              )}

              {/* Guardrail Node */}
              {selectedNode.type === 'guardrail' && (
                <div className="space-y-3">
                  <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                    Enforced Moderation Rules
                  </label>
                  <div className="space-y-1.5">
                    {[
                      { id: 'injection', label: 'Prompt Injection Defense' },
                      { id: 'pii', label: 'PII Redaction (Email, SSN, Credit Cards)' },
                      { id: 'toxic', label: 'Toxic & Harmful Language Filter' },
                      { id: 'hallucination', label: 'Hallucination & Faithfulness Check' },
                    ].map((r) => {
                      const enabled = selectedNode.data.guardrailRules?.includes(r.id);
                      return (
                        <label
                          key={r.id}
                          className="flex items-center gap-2 p-2 rounded-lg border border-neutral-800 bg-neutral-900 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={(e) => {
                              const current = selectedNode.data.guardrailRules || [];
                              const updated = e.target.checked
                                ? [...current, r.id]
                                : current.filter((x) => x !== r.id);
                              setGraph((prev) => ({
                                ...prev,
                                nodes: prev.nodes.map((n) =>
                                  n.id === selectedNode.id
                                    ? { ...n, data: { ...n.data, guardrailRules: updated } }
                                    : n,
                                ),
                              }));
                            }}
                            className="accent-brand-500 rounded"
                          />
                          <span className="text-xs text-neutral-200">{r.label}</span>
                        </label>
                      );
                    })}
                  </div>

                  <SelectField
                    label="Action on Violation"
                    value={selectedNode.data.moderationAction || 'block'}
                    onChange={(val) => {
                      setGraph((prev) => ({
                        ...prev,
                        nodes: prev.nodes.map((n) =>
                          n.id === selectedNode.id
                            ? { ...n, data: { ...n.data, moderationAction: val as any } }
                            : n,
                        ),
                      }));
                    }}
                    options={[
                      { label: 'Block & Return Error', value: 'block' },
                      { label: 'Redact & Continue', value: 'redact' },
                      { label: 'Warn & Log Violation', value: 'warn' },
                    ]}
                  />
                </div>
              )}

              {/* Memory Store Node */}
              {selectedNode.type === 'memory' && (
                <div className="space-y-3">
                  <SelectField
                    label="State Action"
                    value={selectedNode.data.stateAction || 'read'}
                    onChange={(val) => {
                      setGraph((prev) => ({
                        ...prev,
                        nodes: prev.nodes.map((n) =>
                          n.id === selectedNode.id
                            ? { ...n, data: { ...n.data, stateAction: val as any } }
                            : n,
                        ),
                      }));
                    }}
                    options={[
                      { label: 'Read from State Store', value: 'read' },
                      { label: 'Write / Update State Store', value: 'write' },
                      { label: 'Clear State Key', value: 'clear' },
                    ]}
                  />

                  <InputField
                    label="State Key Name"
                    value={selectedNode.data.stateKey || 'session_state'}
                    fontMono
                    onChange={(val) => {
                      setGraph((prev) => ({
                        ...prev,
                        nodes: prev.nodes.map((n) =>
                          n.id === selectedNode.id ? { ...n, data: { ...n.data, stateKey: val } } : n,
                        ),
                      }));
                    }}
                  />
                </div>
              )}

              {/* Code Transform Node */}
              {selectedNode.type === 'transform' && (
                <div className="space-y-3">
                  <TextareaField
                    label="JavaScript Transform Function"
                    value={selectedNode.data.transformCode || 'return { output: input.text.trim() };'}
                    rows={6}
                    fontMono
                    onChange={(val) => {
                      setGraph((prev) => ({
                        ...prev,
                        nodes: prev.nodes.map((n) =>
                          n.id === selectedNode.id ? { ...n, data: { ...n.data, transformCode: val } } : n,
                        ),
                      }));
                    }}
                  />
                </div>
              )}

              {/* Human Approval Node */}
              {selectedNode.type === 'human' && (
                <div className="space-y-3">
                  <TextareaField
                    label="Approval Instructions"
                    value={selectedNode.data.approvalPrompt || ''}
                    placeholder="Instructions for the human reviewer..."
                    rows={3}
                    onChange={(val) => {
                      setGraph((prev) => ({
                        ...prev,
                        nodes: prev.nodes.map((n) =>
                          n.id === selectedNode.id ? { ...n, data: { ...n.data, approvalPrompt: val } } : n,
                        ),
                      }));
                    }}
                  />

                  <SliderField
                    label="Review Timeout (Minutes)"
                    value={selectedNode.data.timeoutMinutes ?? 60}
                    min={5}
                    max={240}
                    step={5}
                    onChange={(val) => {
                      setGraph((prev) => ({
                        ...prev,
                        nodes: prev.nodes.map((n) =>
                          n.id === selectedNode.id ? { ...n, data: { ...n.data, timeoutMinutes: val } } : n,
                        ),
                      }));
                    }}
                  />

                  <SelectField
                    label="Action upon Timeout"
                    value={selectedNode.data.timeoutAction || 'escalate'}
                    onChange={(val) => {
                      setGraph((prev) => ({
                        ...prev,
                        nodes: prev.nodes.map((n) =>
                          n.id === selectedNode.id
                            ? { ...n, data: { ...n.data, timeoutAction: val as any } }
                            : n,
                        ),
                      }));
                    }}
                    options={[
                      { label: 'Escalate to Tier-2', value: 'escalate' },
                      { label: 'Auto-Approve', value: 'auto_approve' },
                      { label: 'Auto-Reject', value: 'auto_reject' },
                    ]}
                  />
                </div>
              )}

              {/* End Output Node */}
              {selectedNode.type === 'end' && (
                <div className="space-y-3">
                  <TextareaField
                    label="Response Template"
                    value={selectedNode.data.endResponseTemplate || '{{agent_output}}'}
                    rows={2}
                    fontMono
                    onChange={(val) => {
                      setGraph((prev) => ({
                        ...prev,
                        nodes: prev.nodes.map((n) =>
                          n.id === selectedNode.id
                            ? { ...n, data: { ...n.data, endResponseTemplate: val } }
                            : n,
                        ),
                      }));
                    }}
                  />

                  <SelectField
                    label="Delivery Channel"
                    value={selectedNode.data.endDeliveryType || 'chat_message'}
                    onChange={(val) => {
                      setGraph((prev) => ({
                        ...prev,
                        nodes: prev.nodes.map((n) =>
                          n.id === selectedNode.id
                            ? { ...n, data: { ...n.data, endDeliveryType: val as any } }
                            : n,
                        ),
                      }));
                    }}
                    options={[
                      { label: 'Streaming Chat Message', value: 'chat_message' },
                      { label: 'Webhook HTTP Callback', value: 'webhook_callback' },
                      { label: 'Human Agent Escalation Queue', value: 'human_escalation' },
                    ]}
                  />
                </div>
              )}

              {/* Delete Node Action */}
              <button
                type="button"
                onClick={() => handleDeleteNode(selectedNode.id)}
                className="mt-6 w-full rounded-lg border border-red-500/30 bg-red-950/20 py-2 text-xs font-medium text-red-400 transition-colors hover:bg-red-950/40"
              >
                Delete Node
              </button>
            </div>
          </aside>
        )}

        {/* ── AI Copilot Drawer (ChatGPT-Style Window) ────────────────── */}
        {isCopilotOpen && (
          <aside className="flex w-96 shrink-0 flex-col border-l border-neutral-800 bg-neutral-950 text-xs z-20">
            {/* Header */}
            <div className="flex h-12 items-center justify-between border-b border-neutral-800 px-4">
              <div className="flex items-center gap-2">
                <div className="flex size-5 items-center justify-center rounded bg-brand-500 text-white">
                  <Sparkles className="size-3" />
                </div>
                <span className="font-semibold text-white">LangGraph Copilot</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setMessages([
                      {
                        id: 'init-new',
                        role: 'assistant',
                        content:
                          'New conversation started. Describe your agent architecture (e.g. "Create a RAG pipeline with safety filters").',
                        timestamp: new Date(),
                      },
                    ])
                  }
                  className="rounded px-2 py-1 text-[11px] text-neutral-400 hover:bg-neutral-800 hover:text-white"
                >
                  + New Chat
                </button>
                <button
                  type="button"
                  onClick={() => setIsCopilotOpen(false)}
                  className="text-neutral-400 hover:text-white"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Suggested Blueprints */}
            <div className="border-b border-neutral-800/80 bg-neutral-900/50 p-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                Suggested Blueprints
              </span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => handleApplyGraph(TEMPLATES.intent_router.graph)}
                  className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-[11px] text-neutral-300 hover:border-neutral-700 hover:text-white transition-colors"
                >
                  Multi-Agent Router
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyGraph(TEMPLATES.rag_researcher.graph)}
                  className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-[11px] text-neutral-300 hover:border-neutral-700 hover:text-white transition-colors"
                >
                  RAG Synthesis Flow
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyGraph(TEMPLATES.safety_guardrail.graph)}
                  className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-[11px] text-neutral-300 hover:border-neutral-700 hover:text-white transition-colors"
                >
                  Safety Guardrailed
                </button>
              </div>
            </div>

            {/* Chat Thread */}
            <div className="flex-1 space-y-3.5 overflow-y-auto p-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-brand-600 text-white shadow-xs'
                        : 'border border-neutral-800 bg-neutral-900 text-neutral-200 shadow-xs'
                    }`}
                  >
                    <p>{msg.content}</p>

                    {/* Apply Graph Action */}
                    {msg.suggestedGraph && (
                      <div className="mt-3 pt-2 border-t border-neutral-800">
                        <button
                          type="button"
                          onClick={() => handleApplyGraph(msg.suggestedGraph!)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 font-semibold text-neutral-950 hover:bg-neutral-200 transition-colors shadow-xs"
                        >
                          <Play className="size-3 fill-neutral-950" />
                          Apply to Canvas
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isAiGenerating && (
                <div className="flex items-center gap-2 text-neutral-400">
                  <Loader2 className="size-3.5 animate-spin text-brand-400" />
                  Generating LangGraph architecture…
                </div>
              )}
            </div>

            {/* Input Bar */}
            <div className="border-t border-neutral-800 p-3">
              <div className="relative">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Describe your LangGraph agent flow..."
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-900 py-2.5 pl-3.5 pr-10 text-xs text-white placeholder-neutral-500 focus:border-brand-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={!chatInput.trim() || isAiGenerating}
                  className="absolute right-2 top-1/2 -translate-y-1/2 size-7 rounded-lg bg-brand-600 flex items-center justify-center text-white hover:bg-brand-500 disabled:opacity-40 transition-colors"
                >
                  <Send className="size-3" />
                </button>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* ── JSON Graph Viewer & Importer Modal ───────────────────────── */}
      {isJsonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="flex max-h-[88vh] w-full max-w-3xl flex-col rounded-2xl border border-neutral-800 bg-neutral-950 p-6 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <Code2 className="size-4 text-brand-400" />
                <h3 className="text-sm font-bold text-white">LangGraph JSON Specification</h3>
              </div>

              {/* Tabs */}
              <div className="flex items-center rounded-lg border border-neutral-800 bg-neutral-900 p-0.5">
                <button
                  type="button"
                  onClick={() => setJsonModalTab('langgraph')}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    jsonModalTab === 'langgraph'
                      ? 'bg-brand-600 text-white'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  LangGraph v1
                </button>
                <button
                  type="button"
                  onClick={() => setJsonModalTab('studio')}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    jsonModalTab === 'studio'
                      ? 'bg-brand-600 text-white'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Studio State
                </button>
                <button
                  type="button"
                  onClick={() => setJsonModalTab('import')}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    jsonModalTab === 'import'
                      ? 'bg-brand-600 text-white'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Import JSON
                </button>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsJsonModalOpen(false)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Tab 1: LangGraph v1 Canonical Execution Spec */}
            {jsonModalTab === 'langgraph' && (
              <div className="flex flex-1 flex-col overflow-hidden pt-3">
                <div className="flex items-center justify-between text-xs text-neutral-400 pb-2">
                  <span>Canonical structured format for LangGraph Python / TypeScript execution engine</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(compiledLangGraph, null, 2));
                        setIsCopied(true);
                        setTimeout(() => setIsCopied(false), 2000);
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-neutral-800 bg-neutral-900 px-2.5 py-1 text-xs font-medium text-neutral-300 hover:border-neutral-700 hover:text-white"
                    >
                      {isCopied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                      {isCopied ? 'Copied!' : 'Copy JSON'}
                    </button>
                  </div>
                </div>
                <pre className="flex-1 overflow-auto rounded-xl border border-neutral-900 bg-black/80 p-4 font-mono text-[11px] leading-relaxed text-emerald-400">
                  {JSON.stringify(compiledLangGraph, null, 2)}
                </pre>
              </div>
            )}

            {/* Tab 2: Raw Studio Layout Graph */}
            {jsonModalTab === 'studio' && (
              <div className="flex flex-1 flex-col overflow-hidden pt-3">
                <div className="flex items-center justify-between text-xs text-neutral-400 pb-2">
                  <span>Visual canvas state with node coordinates and layout positions</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(graph, null, 2));
                      setIsCopied(true);
                      setTimeout(() => setIsCopied(false), 2000);
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-neutral-800 bg-neutral-900 px-2.5 py-1 text-xs font-medium text-neutral-300 hover:border-neutral-700 hover:text-white"
                  >
                    {isCopied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                    {isCopied ? 'Copied!' : 'Copy JSON'}
                  </button>
                </div>
                <pre className="flex-1 overflow-auto rounded-xl border border-neutral-900 bg-black/80 p-4 font-mono text-[11px] leading-relaxed text-sky-400">
                  {JSON.stringify(graph, null, 2)}
                </pre>
              </div>
            )}

            {/* Tab 3: Import JSON to Canvas */}
            {jsonModalTab === 'import' && (
              <div className="flex flex-1 flex-col overflow-hidden pt-3 space-y-3">
                <p className="text-xs text-neutral-400">
                  Paste either a compiled LangGraph JSON specification or a Studio graph state. The editor will
                  automatically parse nodes, edges, routes, and auto-layout the flow onto the canvas.
                </p>

                {importError && (
                  <div className="rounded-lg border border-red-500/40 bg-red-950/40 p-2.5 text-xs text-red-300">
                    {importError}
                  </div>
                )}

                <textarea
                  value={importText}
                  onChange={(e) => {
                    setImportText(e.target.value);
                    setImportError(null);
                  }}
                  placeholder="Paste JSON content here..."
                  className="flex-1 w-full rounded-xl border border-neutral-800 bg-black/80 p-3 font-mono text-xs text-white focus:border-brand-500 focus:outline-none resize-none"
                  rows={10}
                />

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsJsonModalOpen(false)}
                    className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!importText.trim()}
                    onClick={() => {
                      try {
                        const imported = importWorkflowJSON(importText.trim());
                        setGraph(imported);
                        setIsJsonModalOpen(false);
                        setImportText('');
                        setTimeout(() => handleFitView(), 50);
                      } catch (err: any) {
                        setImportError(err.message || 'Invalid JSON syntax.');
                      }
                    }}
                    className="rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-500 disabled:opacity-40"
                  >
                    Import & Render Flow
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
