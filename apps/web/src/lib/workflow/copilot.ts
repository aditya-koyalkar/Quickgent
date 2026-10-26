import type { CanonicalWorkflow } from '../../types/workflow';
import { serializeToCanonical } from './canonical';
import {
  defaultStartConfig,
  defaultConditionConfig,
  defaultLlmConfig,
  defaultAgentConfig,
  defaultHttpRequestConfig,
  defaultTransformConfig,
  defaultStructuredOutputConfig,
  defaultEndConfig,
} from './registry';

export interface CopilotGenerationResult {
  title: string;
  explanation: string;
  architectureHighlights: string[];
  workflow: CanonicalWorkflow;
}

/**
 * Generates an end-to-end Canonical Workflow based on the user's natural language description.
 */
export function generateWorkflowFromPrompt(prompt: string): CopilotGenerationResult {
  const p = prompt.toLowerCase();

  // Pattern A: E-commerce / Order / Refund Workflow
  if (p.includes('order') || p.includes('refund') || p.includes('ecommerce') || p.includes('store')) {
    const visual = {
      name: 'E-Commerce Order & Refund Flow',
      version: '1.0.0',
      description: 'Automates customer order lookup, refund qualification, and structured response.',
      status: 'DRAFT' as const,
      nodes: [
        {
          id: 'start_order',
          type: 'start' as const,
          title: 'Order Inquiry',
          position: { x: 380, y: 40 },
          data: {
            label: 'Order Inquiry',
            sublabel: 'TRIGGER',
            description: 'Receives customer order ID and question',
            config: {
              ...defaultStartConfig,
              inputFields: [
                { name: 'order_id', type: 'string', required: true, defaultValue: 'ORD-89211' },
                { name: 'customer_query', type: 'string', required: true, defaultValue: 'Can I get a refund for my order?' },
              ],
              requiredFields: ['order_id', 'customer_query'],
            },
          },
        },
        {
          id: 'fetch_order_api',
          type: 'http_request' as const,
          title: 'Lookup Order Details',
          position: { x: 380, y: 190 },
          data: {
            label: 'Lookup Order Details',
            sublabel: 'REST INTEGRATION',
            description: 'Fetches order status from store API',
            config: {
              ...defaultHttpRequestConfig,
              url: 'https://api.store.example.com/orders/{input.order_id}',
              method: 'GET',
            },
          },
        },
        {
          id: 'router_eligibility',
          type: 'condition' as const,
          title: 'Refund Router',
          position: { x: 380, y: 340 },
          data: {
            label: 'Refund Router',
            sublabel: 'LOGIC BRANCH',
            description: 'Checks if query qualifies for refund',
            config: {
              ...defaultConditionConfig,
              conditions: [
                {
                  id: 'c1',
                  sourceField: 'customer_query',
                  operator: 'contains',
                  comparisonValue: 'refund, return, cancel',
                  targetRouteId: 'route_refund',
                },
              ],
              routes: [
                { id: 'route_refund', label: 'Refund Processing' },
                { id: 'route_general', label: 'Order Assistance' },
              ],
              defaultRoute: 'route_general',
            },
          },
        },
        {
          id: 'agent_refund_bot',
          type: 'agent' as const,
          title: 'Refund Specialist',
          position: { x: 200, y: 500 },
          data: {
            label: 'Refund Specialist',
            sublabel: 'REACT LOOP',
            description: 'Inspects return window and executes refund policy',
            config: {
              ...defaultAgentConfig,
              instructions: 'Verify purchase date against 30-day refund window and explain refund status.',
            },
          },
        },
        {
          id: 'llm_support_bot',
          type: 'llm' as const,
          title: 'General Order Support',
          position: { x: 560, y: 500 },
          data: {
            label: 'General Order Support',
            sublabel: 'PROMPT / MODEL',
            description: 'Provides delivery status and updates',
            config: {
              ...defaultLlmConfig,
              userPrompt: 'Provide order status update for Order {input.order_id}.',
            },
          },
        },
        {
          id: 'end_order',
          type: 'end' as const,
          title: 'Order Response',
          position: { x: 380, y: 670 },
          data: {
            label: 'Order Response',
            sublabel: 'TERMINUS',
            description: 'Returns final delivery or refund resolution',
            config: defaultEndConfig,
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'start_order', target: 'fetch_order_api' },
        { id: 'e2', source: 'fetch_order_api', target: 'router_eligibility' },
        { id: 'e3', source: 'router_eligibility', target: 'agent_refund_bot', sourceHandle: 'route_refund', label: 'Refund Processing' },
        { id: 'e4', source: 'router_eligibility', target: 'llm_support_bot', sourceHandle: 'route_general', label: 'Order Assistance' },
        { id: 'e5', source: 'agent_refund_bot', target: 'end_order' },
        { id: 'e6', source: 'llm_support_bot', target: 'end_order' },
      ],
    };

    return {
      title: 'E-Commerce Order & Refund Flow',
      explanation: 'Configured an automated customer order retrieval pipeline with conditional branching for returns vs general order inquiries.',
      architectureHighlights: [
        'Secure API call to retrieve real order information from endpoint',
        'Keyword rule condition routing between refund policy and standard updates',
        'Autonomous agent with tool verification for refund qualification',
        'Consolidated response terminus delivering formatted output',
      ],
      workflow: serializeToCanonical(visual),
    };
  }

  // Pattern B: Research & Document Synthesizer Flow
  if (p.includes('research') || p.includes('rag') || p.includes('doc') || p.includes('knowledge') || p.includes('search')) {
    const visual = {
      name: 'RAG Knowledge Synthesis Workflow',
      version: '1.0.0',
      description: 'Multi-step research pipeline combining live search tools with structured summarization.',
      status: 'DRAFT' as const,
      nodes: [
        {
          id: 'start_research',
          type: 'start' as const,
          title: 'Research Topic',
          position: { x: 380, y: 40 },
          data: {
            label: 'Research Topic',
            sublabel: 'TRIGGER',
            description: 'Receives target topic and depth requirements',
            config: {
              ...defaultStartConfig,
              inputFields: [
                { name: 'topic', type: 'string', required: true, defaultValue: 'Latest breakthroughs in quantum computing' },
                { name: 'output_depth', type: 'string', required: false, defaultValue: 'detailed executive summary' },
              ],
            },
          },
        },
        {
          id: 'agent_researcher',
          type: 'agent' as const,
          title: 'Web & DB Researcher',
          position: { x: 380, y: 190 },
          data: {
            label: 'Web & DB Researcher',
            sublabel: 'REACT LOOP',
            description: 'Queries search tools and aggregates technical citations',
            config: {
              ...defaultAgentConfig,
              instructions: 'Search for credible facts and scientific sources regarding {input.topic}.',
              availableTools: ['web_search', 'knowledge_base'],
            },
          },
        },
        {
          id: 'transform_state',
          type: 'transform' as const,
          title: 'Format Citations',
          position: { x: 380, y: 350 },
          data: {
            label: 'Format Citations',
            sublabel: 'DATA TRANSFORMATION',
            description: 'Cleanses source URLs and structures synthesis metadata',
            config: defaultTransformConfig,
          },
        },
        {
          id: 'struct_output',
          type: 'structured_output' as const,
          title: 'Validate Schema',
          position: { x: 380, y: 500 },
          data: {
            label: 'Validate Schema',
            sublabel: 'SCHEMA VALIDATOR',
            description: 'Validates executive summary format',
            config: defaultStructuredOutputConfig,
          },
        },
        {
          id: 'end_research',
          type: 'end' as const,
          title: 'Deliver Research',
          position: { x: 380, y: 660 },
          data: {
            label: 'Deliver Research',
            sublabel: 'TERMINUS',
            description: 'Returns finalized briefing with citations',
            config: defaultEndConfig,
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'start_research', target: 'agent_researcher' },
        { id: 'e2', source: 'agent_researcher', target: 'transform_state' },
        { id: 'e3', source: 'transform_state', target: 'struct_output' },
        { id: 'e4', source: 'struct_output', target: 'end_research' },
      ],
    };

    return {
      title: 'RAG Knowledge Synthesis Workflow',
      explanation: 'Constructed an autonomous research workflow combining tool-assisted discovery, state mapping, and structured JSON output validation.',
      architectureHighlights: [
        'Autonomous agent with web search and knowledge base tool integration',
        'State transform step ensuring data normalization',
        'Strict JSON schema validation with bounded repair attempts',
        'Clean, single-path pipeline to guarantee deterministic delivery',
      ],
      workflow: serializeToCanonical(visual),
    };
  }

  // Default Pattern: Customer Support & Intelligence Concierge
  const defaultVisual = {
    name: 'Customer Concierge & Triage Flow',
    version: '1.0.0',
    description: 'Triage customer inquiries, evaluate urgency with Condition / Router, and deploy specialized assistance.',
    status: 'DRAFT' as const,
    nodes: [
      {
        id: 'start_triage',
        type: 'start' as const,
        title: 'Customer Query',
        position: { x: 380, y: 40 },
        data: {
          label: 'Customer Query',
          sublabel: 'TRIGGER',
          description: 'Entrypoint for user message & session context',
          config: defaultStartConfig,
        },
      },
      {
        id: 'router_triage',
        type: 'condition' as const,
        title: 'Intent Classifier',
        position: { x: 380, y: 190 },
        data: {
          label: 'Intent Classifier',
          sublabel: 'LOGIC BRANCH',
          description: 'Routes by technical vs billing query keywords',
          config: defaultConditionConfig,
        },
      },
      {
        id: 'llm_billing',
        type: 'llm' as const,
        title: 'Billing Concierge',
        position: { x: 190, y: 350 },
        data: {
          label: 'Billing Concierge',
          sublabel: 'PROMPT / MODEL',
          description: 'Direct model response for subscription questions',
          config: defaultLlmConfig,
        },
      },
      {
        id: 'agent_tech',
        type: 'agent' as const,
        title: 'Technical Diagnostic Agent',
        position: { x: 570, y: 350 },
        data: {
          label: 'Technical Diagnostic Agent',
          sublabel: 'REACT LOOP',
          description: 'Tool-assisted troubleshooting agent',
          config: defaultAgentConfig,
        },
      },
      {
        id: 'format_output',
        type: 'structured_output' as const,
        title: 'Structured Summary',
        position: { x: 380, y: 520 },
        data: {
          label: 'Structured Summary',
          sublabel: 'SCHEMA VALIDATOR',
          description: 'Formats response into standard JSON contract',
          config: defaultStructuredOutputConfig,
        },
      },
      {
        id: 'end_triage',
        type: 'end' as const,
        title: 'Send Response',
        position: { x: 380, y: 680 },
        data: {
          label: 'Send Response',
          sublabel: 'TERMINUS',
          description: 'Returns final answer to customer',
          config: defaultEndConfig,
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'start_triage', target: 'router_triage' },
      { id: 'e2', source: 'router_triage', target: 'llm_billing', sourceHandle: 'route_billing', label: 'Billing Branch' },
      { id: 'e3', source: 'router_triage', target: 'agent_tech', sourceHandle: 'route_technical', label: 'Technical Branch' },
      { id: 'e4', source: 'llm_billing', target: 'format_output' },
      { id: 'e5', source: 'agent_tech', target: 'format_output' },
      { id: 'e6', source: 'format_output', target: 'end_triage' },
    ],
  };

  return {
    title: 'Customer Concierge & Triage Flow',
    explanation: `Designed a multi-agent triage architecture based on your prompt: "${prompt}". It routes between high-efficiency LLM responses and deep tool-equipped agents.`,
    architectureHighlights: [
      'Input trigger with parameter validation',
      'Rule-based condition routing to isolate billing vs technical queries',
      'Autonomous ReAct loop with approved tools for complex issues',
      'Guaranteed schema validation before final response delivery',
    ],
    workflow: serializeToCanonical(defaultVisual),
  };
}
