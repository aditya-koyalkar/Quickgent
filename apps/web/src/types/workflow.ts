export type NodeType =
  | 'start'
  | 'agent'
  | 'llm'
  | 'tool'
  | 'condition'
  | 'human'
  | 'end';

export interface WorkflowNodeData {
  label: string;
  sublabel?: string;
  description?: string;
  model?: string;
  temperature?: number;
  systemPrompt?: string;
  userPrompt?: string;
  toolType?: 'web_search' | 'code_exec' | 'knowledge_base' | 'custom_api';
  toolConfig?: Record<string, any>;
  conditionExpr?: string;
  conditionBranches?: string[];
  outputVar?: string;
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
  label?: string; // e.g. "TRUE", "FALSE", "CONFIDENT"
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
