// ── Canonical MVP Workflow Specification (Schema Version 1.0.0) ──────────

export type CoreNodeType =
  | 'start'
  | 'llm'
  | 'agent'
  | 'condition'
  | 'http_request'
  | 'transform'
  | 'structured_output'
  | 'end';

// Legacy compatibility alias
export type NodeType = CoreNodeType | 'classifier' | 'tool' | 'rag' | 'guardrail' | 'memory' | 'human';

// ── Node Configuration Types (Discriminated Unions) ───────────────────

export interface StartInputField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'json';
  required: boolean;
  defaultValue?: any;
  description?: string;
}

export interface StartNodeConfig {
  inputFields: StartInputField[];
  requiredFields: string[];
  defaultValues: Record<string, any>;
  initialState: Record<string, any>;
}

export interface LlmNodeConfig {
  provider: 'openai' | 'anthropic' | 'google' | 'groq' | 'ollama';
  model: string;
  credentialRef: string;
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxOutputTokens: number;
  responseFormat: 'text' | 'json_object';
  outputSchema?: string;
  timeoutMs: number;
  retryPolicy: {
    maxRetries: number;
    backoffMs: number;
  };
}

export interface AgentNodeConfig {
  provider: 'openai' | 'anthropic' | 'google' | 'groq';
  model: string;
  credentialRef: string;
  instructions: string;
  availableTools: string[];
  maxIterations: number;
  maxToolCalls: number;
  maxOutputTokens: number;
  outputSchema?: string;
  timeoutMs: number;
  budgetLimit?: number;
}

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'exists'
  | 'not_exists'
  | 'greater_than'
  | 'less_than';

export interface ConditionRule {
  id: string;
  sourceField: string;
  operator: ConditionOperator;
  comparisonValue: string;
  targetRouteId: string;
}

export interface RouteOption {
  id: string;
  label: string;
  description?: string;
}

export interface ConditionNodeConfig {
  routingMode: 'rules' | 'structured_value';
  conditions: ConditionRule[];
  combineMode: 'AND' | 'OR';
  routes: RouteOption[];
  defaultRoute: string; // fallback route ID
}

export interface HttpHeaderParam {
  key: string;
  value: string;
}

export interface HttpRequestNodeConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  pathParams: HttpHeaderParam[];
  queryParams: HttpHeaderParam[];
  headers: HttpHeaderParam[];
  authenticationType: 'none' | 'bearer' | 'basic' | 'api_key';
  credentialRef?: string;
  bodyMode: 'none' | 'raw_json' | 'form_data';
  bodyMapping: string;
  timeoutMs: number;
  expectedStatusCodes: number[];
  maximumResponseBytes: number;
  retryPolicy: {
    maxRetries: number;
    backoffMs: number;
  };
  responseMapping: {
    targetStateKey: string;
  };
}

export interface TransformAssignment {
  id: string;
  targetKey: string;
  sourceMapping: string;
  valueType: 'string' | 'number' | 'boolean' | 'json';
  constantValue?: any;
}

export interface TransformNodeConfig {
  assignments: TransformAssignment[];
  mergePolicy: 'replace' | 'shallow_merge' | 'deep_merge';
  nullHandling: 'preserve' | 'ignore' | 'drop';
  outputMapping: string;
}

export interface StructuredOutputFieldMapping {
  id: string;
  targetField: string;
  sourceExpression: string;
}

export interface StructuredOutputNodeConfig {
  instructions: string;
  inputMappings: StructuredOutputFieldMapping[];
  outputSchema: string; // JSON Schema string
  requiredFields: string[];
  strictValidation: boolean;
  repairAttempts: number;
  failurePolicy: 'fail_workflow' | 'use_fallback' | 'ignore';
  fallbackJson?: string;
}

export interface EndOutputFieldMapping {
  id: string;
  stateField: string;
  outputKey: string;
}

export interface EndNodeConfig {
  outputMappings: EndOutputFieldMapping[];
  responseFormat: 'text' | 'json';
  includeExecutionId: boolean;
  includeMetadata: boolean;
  terminalStatus: 'COMPLETED' | 'TERMINATED_ERROR' | 'FALLBACK';
  responseTemplate?: string;
}

// ── Generic Node Config Map ──────────────────────────────────────────

export type NodeConfigMap = {
  start: StartNodeConfig;
  llm: LlmNodeConfig;
  agent: AgentNodeConfig;
  condition: ConditionNodeConfig;
  http_request: HttpRequestNodeConfig;
  transform: TransformNodeConfig;
  structured_output: StructuredOutputNodeConfig;
  end: EndNodeConfig;
};

// ── Canonical Workflow JSON Representation ────────────────────────────

export interface CanonicalNodeMetadata {
  description?: string;
  tags?: string[];
  notes?: string;
}

export interface CanonicalNode<T extends CoreNodeType = CoreNodeType> {
  id: string;
  type: T;
  name: string;
  description?: string;
  config: T extends keyof NodeConfigMap ? NodeConfigMap[T] : Record<string, any>;
  position: {
    x: number;
    y: number;
  };
  metadata?: CanonicalNodeMetadata;
}

export interface CanonicalEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string; // route ID for condition branches (e.g. 'route-1', 'fallback')
  targetHandle?: string;
  label?: string;
  description?: string;
}

export interface WorkflowMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkflowSettings {
  maxExecutionDurationMs: number;
  maxNodeExecutions: number;
  environmentVariables?: Record<string, string>;
  debugMode?: boolean;
}

export interface CanonicalWorkflow {
  schemaVersion: '1.0.0';
  workflow: WorkflowMetadata;
  inputSchema: Record<string, any>;
  outputSchema: Record<string, any>;
  stateSchema: Record<string, any>;
  settings: WorkflowSettings;
  nodes: CanonicalNode[];
  edges: CanonicalEdge[];
}

// ── Visual Graph Editor Types (Used in Canvas & UI) ───────────────────

export interface WorkflowNodeData {
  label: string;
  sublabel?: string;
  description?: string;
  outputVar?: string;
  config: Record<string, any>;
  // Runtime status indicators
  status?: 'idle' | 'pending' | 'running' | 'success' | 'failed';
  errorMessage?: string;
  durationMs?: number;
}

export interface WorkflowNode {
  id: string;
  type: CoreNodeType;
  title: string;
  position: { x: number; y: number };
  data: WorkflowNodeData;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  conditionValue?: string;
}

export interface WorkflowGraph {
  id?: string;
  name: string;
  version: string;
  description?: string;
  status: 'DRAFT' | 'LIVE' | 'ARCHIVED';
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport?: { x: number; y: number; zoom: number };
}

// ── Validation Types ──────────────────────────────────────────────────

export interface ValidationIssue {
  id: string;
  nodeId?: string;
  edgeId?: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  field?: string;
  suggestion?: string;
}

export interface WorkflowValidationResult {
  isValid: boolean;
  canExecute: boolean;
  canPublish: boolean;
  issues: ValidationIssue[];
  summary: {
    errors: number;
    warnings: number;
    infos: number;
  };
}

// ── Execution Trace & Testing Types ───────────────────────────────────

export interface ToolCallTrace {
  id: string;
  toolName: string;
  arguments: Record<string, any>;
  result: any;
  durationMs: number;
  status: 'success' | 'failed';
}

export interface NodeExecutionTrace {
  nodeId: string;
  nodeName: string;
  nodeType: CoreNodeType;
  status: 'pending' | 'running' | 'success' | 'failed';
  inputData: Record<string, any>;
  outputData?: Record<string, any>;
  selectedRoute?: string;
  toolCalls?: ToolCallTrace[];
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  durationMs: number;
  error?: string;
  startedAt: string;
  finishedAt?: string;
}

export interface WorkflowExecutionTrace {
  id: string;
  workflowId: string;
  version: string;
  status: 'running' | 'completed' | 'failed' | 'timeout';
  inputs: Record<string, any>;
  outputs?: Record<string, any>;
  state: Record<string, any>;
  stepTraces: NodeExecutionTrace[];
  totalDurationMs: number;
  totalTokens: number;
  startedAt: string;
  finishedAt?: string;
  error?: string;
}

// ── Publishing & Deployment Types ─────────────────────────────────────

export interface PublishedVersion {
  version: string;
  publishedAt: string;
  publishedBy?: string;
  changelog?: string;
  workflowSnapshot: CanonicalWorkflow;
  deploymentUrl?: string;
  apiKeyPrefix?: string;
  isCurrentLive: boolean;
}
