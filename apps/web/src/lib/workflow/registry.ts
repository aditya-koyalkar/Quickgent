import React from 'react';
import {
  PlayCircle,
  Bot,
  Cpu,
  GitFork,
  Globe,
  Code,
  FileCheck2,
  CheckCircle2,
} from 'lucide-react';
import type {
  CoreNodeType,
  NodeConfigMap,
  StartNodeConfig,
  LlmNodeConfig,
  AgentNodeConfig,
  ConditionNodeConfig,
  HttpRequestNodeConfig,
  TransformNodeConfig,
  StructuredOutputNodeConfig,
  EndNodeConfig,
} from '../../types/workflow';

export interface NodeDefinition<T extends CoreNodeType = CoreNodeType> {
  type: T;
  label: string;
  sublabel: string;
  category: 'Triggers' | 'AI' | 'Logic' | 'Data' | 'Integrations' | 'Outputs';
  description: string;
  accentColor: string;
  badgeClass: string;
  borderClass: string;
  icon: React.ReactElement;
  hasInputHandle: boolean;
  hasOutputHandle: boolean;
  defaultConfig: NodeConfigMap[T];
}

// ── Default Configurations for the 8 Core Nodes ───────────────────────

export const defaultStartConfig: StartNodeConfig = {
  inputFields: [
    {
      name: 'user_message',
      type: 'string',
      required: true,
      defaultValue: '',
      description: 'Incoming customer request or query',
    },
    {
      name: 'session_id',
      type: 'string',
      required: false,
      defaultValue: 'sess_default_01',
      description: 'Unique session or conversation identifier',
    },
  ],
  requiredFields: ['user_message'],
  defaultValues: {
    user_message: 'How do I upgrade my subscription plan?',
    session_id: 'sess_default_01',
  },
  initialState: {
    system_status: 'online',
  },
};

export const defaultLlmConfig: LlmNodeConfig = {
  provider: 'openai',
  model: 'gpt-4o-mini',
  credentialRef: 'env:OPENAI_API_KEY',
  systemPrompt: 'You are a professional assistant. Answer questions clearly and concisely.',
  userPrompt: '{input.user_message}',
  temperature: 0.2,
  maxOutputTokens: 1024,
  responseFormat: 'text',
  timeoutMs: 30000,
  retryPolicy: {
    maxRetries: 2,
    backoffMs: 1000,
  },
};

export const defaultAgentConfig: AgentNodeConfig = {
  provider: 'openai',
  model: 'gpt-4o',
  credentialRef: 'env:OPENAI_API_KEY',
  instructions:
    'You are an autonomous AI specialist. Analyze the input, utilize your available tools iteratively to gather information, and provide the final solution.',
  availableTools: ['web_search', 'knowledge_base'],
  maxIterations: 6,
  maxToolCalls: 8,
  maxOutputTokens: 2048,
  timeoutMs: 60000,
  budgetLimit: 0.25,
};

export const defaultConditionConfig: ConditionNodeConfig = {
  routingMode: 'rules',
  combineMode: 'OR',
  conditions: [
    {
      id: 'cond_tech',
      sourceField: 'user_message',
      operator: 'contains',
      comparisonValue: 'bug, error, failure, code, api',
      targetRouteId: 'route_technical',
    },
    {
      id: 'cond_billing',
      sourceField: 'user_message',
      operator: 'contains',
      comparisonValue: 'price, billing, refund, invoice, subscription',
      targetRouteId: 'route_billing',
    },
  ],
  routes: [
    {
      id: 'route_technical',
      label: 'Technical Branch',
      description: 'Queries related to code, errors, and system faults',
    },
    {
      id: 'route_billing',
      label: 'Billing Branch',
      description: 'Queries regarding invoices, tiers, and refunds',
    },
  ],
  defaultRoute: 'route_billing',
};

export const defaultHttpRequestConfig: HttpRequestNodeConfig = {
  method: 'POST',
  url: 'https://api.example.com/v1/webhook',
  pathParams: [],
  queryParams: [],
  headers: [{ key: 'Content-Type', value: 'application/json' }],
  authenticationType: 'bearer',
  credentialRef: 'env:EXTERNAL_API_TOKEN',
  bodyMode: 'raw_json',
  bodyMapping: JSON.stringify({ query: '{input.user_message}' }, null, 2),
  timeoutMs: 15000,
  expectedStatusCodes: [200, 201],
  maximumResponseBytes: 524288,
  retryPolicy: {
    maxRetries: 2,
    backoffMs: 1500,
  },
  responseMapping: {
    targetStateKey: 'api_response',
  },
};

export const defaultTransformConfig: TransformNodeConfig = {
  assignments: [
    {
      id: 'assign_1',
      targetKey: 'processed_timestamp',
      sourceMapping: 'timestamp',
      valueType: 'string',
      constantValue: '2026-10-26T19:00:00Z',
    },
    {
      id: 'assign_2',
      targetKey: 'user_intent_label',
      sourceMapping: 'condition_route',
      valueType: 'string',
    },
  ],
  mergePolicy: 'shallow_merge',
  nullHandling: 'preserve',
  outputMapping: 'transformed_data',
};

export const defaultStructuredOutputConfig: StructuredOutputNodeConfig = {
  instructions: 'Extract structured parameters and sentiment classification from the conversation context.',
  inputMappings: [
    {
      id: 'map_1',
      targetField: 'customer_query',
      sourceExpression: '{input.user_message}',
    },
  ],
  outputSchema: JSON.stringify(
    {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        sentiment: {
          type: 'string',
          enum: ['positive', 'neutral', 'negative'],
        },
        category: {
          type: 'string',
          enum: ['support', 'billing', 'feature_request', 'other'],
        },
        confidence_score: {
          type: 'number',
          minimum: 0,
          maximum: 1,
        },
        summary: {
          type: 'string',
        },
      },
      required: ['sentiment', 'category', 'summary'],
    },
    null,
    2,
  ),
  requiredFields: ['sentiment', 'category', 'summary'],
  strictValidation: true,
  repairAttempts: 2,
  failurePolicy: 'use_fallback',
  fallbackJson: JSON.stringify({
    sentiment: 'neutral',
    category: 'other',
    confidence_score: 0.5,
    summary: 'Fallback generated due to schema validation failure.',
  }),
};

export const defaultEndConfig: EndNodeConfig = {
  outputMappings: [
    {
      id: 'out_1',
      stateField: 'agent_output',
      outputKey: 'response_message',
    },
    {
      id: 'out_2',
      stateField: 'session_id',
      outputKey: 'conversation_id',
    },
  ],
  responseFormat: 'json',
  includeExecutionId: true,
  includeMetadata: true,
  terminalStatus: 'COMPLETED',
  responseTemplate: '{{agent_output}}',
};

// ── Node Definitions Catalogue ────────────────────────────────────────

export const NODE_REGISTRY: Record<CoreNodeType, NodeDefinition<any>> = {
  start: {
    type: 'start',
    label: 'Start Trigger',
    sublabel: 'TRIGGER',
    category: 'Triggers',
    description: 'Defines workflow input schema and initializes workflow state.',
    accentColor: '#10b981',
    badgeClass: 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/40',
    borderClass: 'border-emerald-500/50',
    icon: React.createElement(PlayCircle, { className: 'size-3.5 text-emerald-400' }),
    hasInputHandle: false,
    hasOutputHandle: true,
    defaultConfig: defaultStartConfig,
  },
  llm: {
    type: 'llm',
    label: 'LLM Node',
    sublabel: 'PROMPT / MODEL',
    category: 'AI',
    description: 'Executes a single language-model call with temperature, system prompt and prompt templates.',
    accentColor: '#c084fc',
    badgeClass: 'bg-purple-950/70 text-purple-300 border border-purple-800/40',
    borderClass: 'border-purple-500/50',
    icon: React.createElement(Cpu, { className: 'size-3.5 text-purple-400' }),
    hasInputHandle: true,
    hasOutputHandle: true,
    defaultConfig: defaultLlmConfig,
  },
  agent: {
    type: 'agent',
    label: 'AI Agent',
    sublabel: 'REACT LOOP',
    category: 'AI',
    description: 'Executes an autonomous agent task with bounded iterations and approved tool calls.',
    accentColor: '#818cf8',
    badgeClass: 'bg-indigo-950/70 text-indigo-300 border border-indigo-800/40',
    borderClass: 'border-indigo-500/50',
    icon: React.createElement(Bot, { className: 'size-3.5 text-indigo-400' }),
    hasInputHandle: true,
    hasOutputHandle: true,
    defaultConfig: defaultAgentConfig,
  },
  condition: {
    type: 'condition',
    label: 'Condition / Router',
    sublabel: 'LOGIC BRANCH',
    category: 'Logic',
    description: 'Evaluates conditional rules or structured fields and routes execution down named branches.',
    accentColor: '#fb923c',
    badgeClass: 'bg-orange-950/70 text-orange-300 border border-orange-800/40',
    borderClass: 'border-orange-500/50',
    icon: React.createElement(GitFork, { className: 'size-3.5 text-orange-400' }),
    hasInputHandle: true,
    hasOutputHandle: true, // Output handles are per-branch!
    defaultConfig: defaultConditionConfig,
  },
  http_request: {
    type: 'http_request',
    label: 'HTTP Request / Tool',
    sublabel: 'REST INTEGRATION',
    category: 'Integrations',
    description: 'Connects workflow to external APIs with secure credentials, headers and body mapping.',
    accentColor: '#2dd4bf',
    badgeClass: 'bg-teal-950/70 text-teal-300 border border-teal-800/40',
    borderClass: 'border-teal-500/50',
    icon: React.createElement(Globe, { className: 'size-3.5 text-teal-400' }),
    hasInputHandle: true,
    hasOutputHandle: true,
    defaultConfig: defaultHttpRequestConfig,
  },
  transform: {
    type: 'transform',
    label: 'Set State / Transform',
    sublabel: 'DATA TRANSFORMATION',
    category: 'Data',
    description: 'Updates workflow state variables and maps data between nodes without unsafe code execution.',
    accentColor: '#e879f9',
    badgeClass: 'bg-fuchsia-950/70 text-fuchsia-300 border border-fuchsia-800/40',
    borderClass: 'border-fuchsia-500/50',
    icon: React.createElement(Code, { className: 'size-3.5 text-fuchsia-400' }),
    hasInputHandle: true,
    hasOutputHandle: true,
    defaultConfig: defaultTransformConfig,
  },
  structured_output: {
    type: 'structured_output',
    label: 'Structured Output',
    sublabel: 'SCHEMA VALIDATOR',
    category: 'AI',
    description: 'Generates and strictly validates JSON data against a defined JSON Schema with retry policy.',
    accentColor: '#38bdf8',
    badgeClass: 'bg-sky-950/70 text-sky-300 border border-sky-800/40',
    borderClass: 'border-sky-500/50',
    icon: React.createElement(FileCheck2, { className: 'size-3.5 text-sky-400' }),
    hasInputHandle: true,
    hasOutputHandle: true,
    defaultConfig: defaultStructuredOutputConfig,
  },
  end: {
    type: 'end',
    label: 'End / Response',
    sublabel: 'TERMINUS',
    category: 'Outputs',
    description: 'Terminates workflow execution and returns mapped state values to the caller.',
    accentColor: '#94a3b8',
    badgeClass: 'bg-neutral-800 text-neutral-300 border border-neutral-700/40',
    borderClass: 'border-neutral-600/50',
    icon: React.createElement(CheckCircle2, { className: 'size-3.5 text-neutral-400' }),
    hasInputHandle: true,
    hasOutputHandle: false,
    defaultConfig: defaultEndConfig,
  },
};

// ── Palette Organization ──────────────────────────────────────────────

export const PALETTE_CATEGORIES = [
  {
    name: 'Triggers',
    description: 'Workflow entrypoints',
    types: ['start'] as CoreNodeType[],
  },
  {
    name: 'AI',
    description: 'Language models and autonomous agents',
    types: ['llm', 'agent', 'structured_output'] as CoreNodeType[],
  },
  {
    name: 'Logic',
    description: 'Routing and decision branches',
    types: ['condition'] as CoreNodeType[],
  },
  {
    name: 'Data',
    description: 'State updates and safe transformation',
    types: ['transform'] as CoreNodeType[],
  },
  {
    name: 'Integrations',
    description: 'External APIs and tools',
    types: ['http_request'] as CoreNodeType[],
  },
  {
    name: 'Outputs',
    description: 'Workflow response delivery',
    types: ['end'] as CoreNodeType[],
  },
];
