import { describe, it, expect } from 'vitest';
import {
  serializeToCanonical,
  deserializeFromCanonical,
  parseAndValidateWorkflowJson,
  createDefaultCanonicalWorkflow,
} from '../src/lib/workflow/canonical';
import { validateWorkflow } from '../src/lib/workflow/validation';
import { executeWorkflow, interpolateTemplate } from '../src/lib/workflow/runtime';
import { generateWorkflowFromPrompt } from '../src/lib/workflow/copilot';
import type { WorkflowGraph } from '../src/types/workflow';

describe('Canonical Workflow Serialization & Deserialization', () => {
  it('creates default canonical workflow with schemaVersion 1.0.0', () => {
    const canonical = createDefaultCanonicalWorkflow();
    expect(canonical.schemaVersion).toBe('1.0.0');
    expect(canonical.nodes.length).toBeGreaterThanOrEqual(4);
    expect(canonical.edges.length).toBeGreaterThanOrEqual(3);
    expect(canonical.workflow.name).toBeDefined();
  });

  it('performs lossless roundtrip between WorkflowGraph and CanonicalWorkflow', () => {
    const canonical = createDefaultCanonicalWorkflow();
    const visualGraph = deserializeFromCanonical(canonical);
    expect(visualGraph.nodes.length).toBe(canonical.nodes.length);
    expect(visualGraph.edges.length).toBe(canonical.edges.length);

    const reserialized = serializeToCanonical(visualGraph);
    expect(reserialized.schemaVersion).toBe('1.0.0');
    expect(reserialized.nodes.length).toBe(canonical.nodes.length);
    expect(reserialized.edges.length).toBe(canonical.edges.length);
  });

  it('parses valid JSON string into canonical workflow and rejects invalid syntax', () => {
    const canonical = createDefaultCanonicalWorkflow();
    const jsonStr = JSON.stringify(canonical);
    const parsed = parseAndValidateWorkflowJson(jsonStr);
    expect(parsed.schemaVersion).toBe('1.0.0');

    expect(() => parseAndValidateWorkflowJson('{ invalid json ')).toThrow();
    expect(() => parseAndValidateWorkflowJson('{"random": "payload"}')).toThrow();
  });
});

describe('Graph Validation Rules', () => {
  it('detects missing Start node as an error', () => {
    const graph: WorkflowGraph = {
      name: 'No Start Workflow',
      version: '1.0.0',
      status: 'DRAFT',
      nodes: [
        {
          id: 'n_end',
          type: 'end',
          title: 'End Node',
          position: { x: 100, y: 100 },
          data: { label: 'End', config: {} },
        },
      ],
      edges: [],
    };

    const res = validateWorkflow(graph);
    expect(res.isValid).toBe(false);
    expect(res.issues.some((i) => i.id === 'issue_no_start')).toBe(true);
  });

  it('detects multiple Start nodes as errors', () => {
    const graph: WorkflowGraph = {
      name: 'Double Start',
      version: '1.0.0',
      status: 'DRAFT',
      nodes: [
        { id: 's1', type: 'start', title: 'Start 1', position: { x: 0, y: 0 }, data: { label: 'S1', config: {} } },
        { id: 's2', type: 'start', title: 'Start 2', position: { x: 0, y: 100 }, data: { label: 'S2', config: {} } },
        { id: 'e1', type: 'end', title: 'End', position: { x: 200, y: 50 }, data: { label: 'End', config: {} } },
      ],
      edges: [{ id: 'e1', source: 's1', target: 'e1' }],
    };

    const res = validateWorkflow(graph);
    expect(res.isValid).toBe(false);
    expect(res.issues.some((i) => i.message.includes('Multiple Start nodes'))).toBe(true);
  });

  it('detects missing End node as an error', () => {
    const graph: WorkflowGraph = {
      name: 'No End Workflow',
      version: '1.0.0',
      status: 'DRAFT',
      nodes: [
        { id: 's1', type: 'start', title: 'Start', position: { x: 0, y: 0 }, data: { label: 'Start', config: {} } },
      ],
      edges: [],
    };

    const res = validateWorkflow(graph);
    expect(res.isValid).toBe(false);
    expect(res.issues.some((i) => i.id === 'issue_no_end')).toBe(true);
  });

  it('detects hardcoded secret keys in node configuration', () => {
    const graph: WorkflowGraph = {
      name: 'Leaky Workflow',
      version: '1.0.0',
      status: 'DRAFT',
      nodes: [
        {
          id: 's1',
          type: 'start',
          title: 'Start',
          position: { x: 0, y: 0 },
          data: { label: 'Start', config: { inputFields: [{ name: 'msg', type: 'string', required: true }] } },
        },
        {
          id: 'llm1',
          type: 'llm',
          title: 'Leaky LLM',
          position: { x: 100, y: 100 },
          data: {
            label: 'LLM',
            config: {
              model: 'gpt-4o',
              userPrompt: 'Hello',
              apiKey: 'sk-1234567890abcdef1234567890abcdef',
            },
          },
        },
        {
          id: 'e1',
          type: 'end',
          title: 'End',
          position: { x: 200, y: 200 },
          data: { label: 'End', config: {} },
        },
      ],
      edges: [
        { id: 'e1', source: 's1', target: 'llm1' },
        { id: 'e2', source: 'llm1', target: 'e1' },
      ],
    };

    const res = validateWorkflow(graph);
    expect(res.issues.some((i) => i.id.startsWith('issue_secret_leak_'))).toBe(true);
  });

  it('detects cycles in graph connections', () => {
    const graph: WorkflowGraph = {
      name: 'Cyclic Workflow',
      version: '1.0.0',
      status: 'DRAFT',
      nodes: [
        { id: 's1', type: 'start', title: 'Start', position: { x: 0, y: 0 }, data: { label: 'Start', config: {} } },
        { id: 'a1', type: 'agent', title: 'Agent 1', position: { x: 100, y: 100 }, data: { label: 'A1', config: {} } },
        { id: 'a2', type: 'agent', title: 'Agent 2', position: { x: 200, y: 100 }, data: { label: 'A2', config: {} } },
        { id: 'e1', type: 'end', title: 'End', position: { x: 300, y: 200 }, data: { label: 'End', config: {} } },
      ],
      edges: [
        { id: 'e1', source: 's1', target: 'a1' },
        { id: 'e2', source: 'a1', target: 'a2' },
        { id: 'e3', source: 'a2', target: 'a1' }, // cycle
        { id: 'e4', source: 'a2', target: 'e1' },
      ],
    };

    const res = validateWorkflow(graph);
    expect(res.issues.some((i) => i.id === 'issue_graph_cycle')).toBe(true);
  });

  it('detects condition rules targeting invalid/non-existent routes as validation errors', () => {
    const graph: WorkflowGraph = {
      name: 'Mismatched Routes Workflow',
      version: '1.0.0',
      status: 'DRAFT',
      nodes: [
        { id: 's1', type: 'start', title: 'Start', position: { x: 0, y: 0 }, data: { label: 'Start', config: {} } },
        {
          id: 'c1',
          type: 'condition',
          title: 'Condition Router',
          position: { x: 100, y: 0 },
          data: {
            label: 'Condition',
            config: {
              routes: [
                { id: 'route_refund', label: 'Refund' },
                { id: 'route_other', label: 'Other' },
              ],
              conditions: [
                {
                  id: 'rule_1',
                  sourceField: '', // empty source field
                  operator: 'equals',
                  comparisonValue: 'refund',
                  targetRouteId: 'route_technical', // does NOT exist in routes!
                },
              ],
            },
          },
        },
        { id: 'e1', type: 'end', title: 'End', position: { x: 300, y: 0 }, data: { label: 'End', config: {} } },
      ],
      edges: [
        { id: 'e1', source: 's1', target: 'c1' },
        { id: 'e2', source: 'c1', target: 'e1' },
      ],
    };

    const res = validateWorkflow(graph);
    expect(res.isValid).toBe(false);
    expect(res.issues.some((i) => i.id.startsWith('issue_cond_invalid_target_'))).toBe(true);
    expect(res.issues.some((i) => i.id.startsWith('issue_cond_empty_field_'))).toBe(true);
  });
});

describe('Workflow Runtime Engine & Execution Traces', () => {
  it('correctly interpolates state and input variable templates', () => {
    const state = {
      input: { user_message: 'Upgrade account', tier: 'Pro' },
      state_val: 'Verified',
    };

    const res = interpolateTemplate('Query: {input.user_message} (Tier: {input.tier}) Status: {state_val}', state);
    expect(res).toBe('Query: Upgrade account (Tier: Pro) Status: Verified');
  });

  it('executes workflow and navigates conditional routing correctly', async () => {
    const canonical = createDefaultCanonicalWorkflow();
    const visualGraph = deserializeFromCanonical(canonical);

    // Test technical branch routing
    const techTrace = await executeWorkflow(visualGraph, {
      inputs: {
        user_message: 'We have a critical system bug in the API',
        session_id: 'test_sess_01',
      },
      mockDelayMs: 0,
    });

    expect(techTrace.status).toBe('completed');
    expect(techTrace.stepTraces.length).toBeGreaterThanOrEqual(4);

    const conditionStep = techTrace.stepTraces.find((t) => t.nodeType === 'condition');
    expect(conditionStep).toBeDefined();
    expect(conditionStep?.selectedRoute).toBe('route_technical');

    // Verify step traces recorded tokens and durations
    expect(techTrace.totalDurationMs).toBeGreaterThanOrEqual(0);
    expect(techTrace.totalTokens).toBeGreaterThan(0);
    expect(techTrace.outputs).toBeDefined();
  });
});

describe('Natural Language AI Copilot', () => {
  it('generates valid canonical workflow from user prompt', () => {
    const result = generateWorkflowFromPrompt('Build an e-commerce order refund agent with API verification');
    expect(result.workflow.schemaVersion).toBe('1.0.0');
    expect(result.workflow.nodes.length).toBeGreaterThanOrEqual(4);
    expect(result.title).toBeDefined();
    expect(result.architectureHighlights.length).toBeGreaterThan(0);

    const validation = validateWorkflow(result.workflow);
    expect(validation.canExecute).toBe(true);
  });
});
