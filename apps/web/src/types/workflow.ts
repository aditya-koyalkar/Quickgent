export type NodeType =
  | 'start'
  | 'agent'
  | 'llm'
  | 'classifier'
  | 'condition'
  | 'tool'
  | 'rag'
  | 'api_request'
  | 'guardrail'
  | 'memory'
  | 'transform'
  | 'human'
  | 'end';

export interface RouteOption {
  id: string;
  label: string;
  description?: string;
  targetNodeId?: string;
  conditionExpr?: string;
}

export interface InputParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'json';
  required: boolean;
  defaultValue?: string;
  description?: string;
}

export interface WorkflowNodeData {
  label: string;
  sublabel?: string;
  description?: string;
  outputVar?: string;

  // Agent specific properties (Autonomous ReAct Loop)
  model?: string;
  temperature?: number;
  maxTokens?: number;
  maxSteps?: number;
  systemPrompt?: string;
  userPrompt?: string;
  tools?: string[];
  memoryType?: 'none' | 'buffer' | 'summary' | 'vector';

  // LLM Node specific properties (Single-pass inference)
  responseFormat?: 'text' | 'json_object';

  // Intent Classifier & Semantic Routing
  classifierMode?: 'semantic' | 'llm' | 'regex';
  inputVar?: string;
  classifierPrompt?: string;
  routes?: RouteOption[];
  fallbackRoute?: string;
  fallbackTargetNodeId?: string;

  // Condition / Rule Logic
  conditionExpr?: string;
  trueBranchLabel?: string;
  falseBranchLabel?: string;
  trueTargetNodeId?: string;
  falseTargetNodeId?: string;

  // Tool & RAG Retrieval
  toolType?:
    | 'web_search'
    | 'code_exec'
    | 'knowledge_base'
    | 'custom_api'
    | 'sql_database';
  toolConfig?: Record<string, any>;
  apiUrl?: string;
  apiMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  apiHeaders?: string;
  apiBody?: string;
  ragCollection?: string;
  queryTemplate?: string;
  topK?: number;
  similarityThreshold?: number;

  // Guardrail / Content Moderation
  guardrailRules?: string[];
  moderationAction?: 'block' | 'redact' | 'warn';

  // Memory & State Node
  stateAction?: 'read' | 'write' | 'clear';
  stateKey?: string;

  // Transform / Code node
  transformCode?: string;

  // Human in the loop
  approvalPrompt?: string;
  timeoutMinutes?: number;
  timeoutAction?: 'auto_approve' | 'auto_reject' | 'escalate';

  // Start & End nodes
  inputParams?: InputParameter[];
  endResponseTemplate?: string;
  endDeliveryType?: 'chat_message' | 'webhook_callback' | 'human_escalation';
}

export interface WorkflowNode {
  id: string;
  type: NodeType;
  title: string;
  position: { x: number; y: number };
  data: WorkflowNodeData;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string; // e.g. "Intent: Billing", "TRUE", "FALSE"
  conditionValue?: string;
}

export interface WorkflowGraph {
  id?: string;
  name: string;
  version: string;
  status: 'DRAFT' | 'LIVE' | 'ARCHIVED';
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport?: { x: number; y: number; zoom: number };
}
