import type {
  WorkflowGraph,
  WorkflowValidationResult,
  ValidationIssue,
  CanonicalWorkflow,
} from '../../types/workflow';

function getNodeTitle(node: any): string {
  return node.title || node.name || node.id || 'Node';
}

/**
 * Validates a workflow graph (either visual graph or canonical) and produces
 * actionable issues with node/edge references.
 */
export function validateWorkflow(graph: WorkflowGraph | CanonicalWorkflow): WorkflowValidationResult {
  const issues: ValidationIssue[] = [];

  const nodes = 'nodes' in graph ? graph.nodes : [];
  const edges = 'edges' in graph ? graph.edges : [];

  // 1. Entry Point Validation
  const startNodes = nodes.filter((n) => n.type === 'start');
  if (startNodes.length === 0) {
    issues.push({
      id: 'issue_no_start',
      severity: 'error',
      message: 'Workflow is missing a Start Trigger node. Workflows require an entry point.',
      suggestion: 'Add a Start node from the Triggers palette to define input fields.',
    });
  } else if (startNodes.length > 1) {
    startNodes.slice(1).forEach((n) => {
      issues.push({
        id: `issue_multi_start_${n.id}`,
        nodeId: n.id,
        severity: 'error',
        message: `Multiple Start nodes detected ("${getNodeTitle(n)}"). Only one Start node is allowed.`,
        suggestion: 'Remove redundant Start nodes so the execution entry point is unambiguous.',
      });
    });
  }

  // 2. Terminus Validation
  const endNodes = nodes.filter((n) => n.type === 'end');
  if (endNodes.length === 0) {
    issues.push({
      id: 'issue_no_end',
      severity: 'error',
      message: 'Workflow is missing an End / Response node.',
      suggestion: 'Add an End node from the Outputs palette to return results to the caller.',
    });
  }

  // 3. Edge Reference and Handle Integrity
  const nodeMap = new Map<string, any>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  const incomingCount = new Map<string, number>();
  const outgoingCount = new Map<string, number>();
  nodes.forEach((n) => {
    incomingCount.set(n.id, 0);
    outgoingCount.set(n.id, 0);
  });

  edges.forEach((edge) => {
    const srcNode = nodeMap.get(edge.source);
    const tgtNode = nodeMap.get(edge.target);

    if (!srcNode) {
      issues.push({
        id: `issue_edge_src_${edge.id}`,
        edgeId: edge.id,
        severity: 'error',
        message: `Edge "${edge.id}" references non-existent source node "${edge.source}".`,
        suggestion: 'Delete or reconnect this edge to a valid node.',
      });
      return;
    }

    if (!tgtNode) {
      issues.push({
        id: `issue_edge_tgt_${edge.id}`,
        edgeId: edge.id,
        severity: 'error',
        message: `Edge "${edge.id}" references non-existent target node "${edge.target}".`,
        suggestion: 'Delete or reconnect this edge to a valid node.',
      });
      return;
    }

    // Input/output compatibility check
    if (tgtNode.type === 'start') {
      issues.push({
        id: `issue_edge_to_start_${edge.id}`,
        edgeId: edge.id,
        nodeId: tgtNode.id,
        severity: 'error',
        message: 'Start nodes cannot receive incoming connections.',
        suggestion: 'Remove edges pointing into the Start Trigger.',
      });
    }

    if (srcNode.type === 'end') {
      issues.push({
        id: `issue_edge_from_end_${edge.id}`,
        edgeId: edge.id,
        nodeId: srcNode.id,
        severity: 'error',
        message: 'End / Response nodes cannot have outgoing connections.',
        suggestion: 'Remove edges originating from the End node.',
      });
    }

    outgoingCount.set(edge.source, (outgoingCount.get(edge.source) || 0) + 1);
    incomingCount.set(edge.target, (incomingCount.get(edge.target) || 0) + 1);
  });

  // 4. Reachability & Disconnected Node Checks
  nodes.forEach((node) => {
    const inCount = incomingCount.get(node.id) || 0;
    const outCount = outgoingCount.get(node.id) || 0;

    if (node.type !== 'start' && inCount === 0) {
      issues.push({
        id: `issue_unreachable_${node.id}`,
        nodeId: node.id,
        severity: 'warning',
        message: `Node "${getNodeTitle(node)}" has no incoming connection and will not execute.`,
        suggestion: 'Connect an upstream node to this node or remove it.',
      });
    }

    if (node.type !== 'end' && outCount === 0) {
      issues.push({
        id: `issue_dead_end_${node.id}`,
        nodeId: node.id,
        severity: 'warning',
        message: `Node "${getNodeTitle(node)}" is a dead end with no outgoing connections.`,
        suggestion: 'Connect this node to an End node or subsequent processing step.',
      });
    }
  });

  // 5. Node-Specific Configuration Validation
  nodes.forEach((node) => {
    const config = (node as any).config || (node as any).data?.config || {};
    const title = getNodeTitle(node);

    // A. Start Node
    if (node.type === 'start') {
      const fields = config.inputFields || [];
      if (fields.length === 0) {
        issues.push({
          id: `issue_start_nofields_${node.id}`,
          nodeId: node.id,
          severity: 'warning',
          field: 'inputFields',
          message: `Start node "${title}" has no defined input fields.`,
          suggestion: 'Configure at least one input field (e.g. user_message).',
        });
      }
    }

    // B. LLM Node
    if (node.type === 'llm') {
      if (!config.model?.trim()) {
        issues.push({
          id: `issue_llm_nomodel_${node.id}`,
          nodeId: node.id,
          severity: 'error',
          field: 'model',
          message: `LLM node "${title}" has no model specified.`,
          suggestion: 'Select a valid model (e.g. gpt-4o-mini, claude-3-5-sonnet).',
        });
      }
      if (!config.userPrompt?.trim()) {
        issues.push({
          id: `issue_llm_noprompt_${node.id}`,
          nodeId: node.id,
          severity: 'error',
          field: 'userPrompt',
          message: `LLM node "${title}" has an empty user prompt.`,
          suggestion: 'Provide a prompt template utilizing state variables like {input.user_message}.',
        });
      }
    }

    // C. AI Agent Node
    if (node.type === 'agent') {
      if (!config.model?.trim()) {
        issues.push({
          id: `issue_agent_nomodel_${node.id}`,
          nodeId: node.id,
          severity: 'error',
          field: 'model',
          message: `Agent node "${title}" has no model selected.`,
          suggestion: 'Select a reasoning model for the agent loop.',
        });
      }
      if (!config.instructions?.trim()) {
        issues.push({
          id: `issue_agent_noinst_${node.id}`,
          nodeId: node.id,
          severity: 'warning',
          field: 'instructions',
          message: `Agent node "${title}" has empty system instructions.`,
          suggestion: 'Define the agent persona, role, and operational constraints.',
        });
      }
      if (!config.maxIterations || config.maxIterations < 1) {
        issues.push({
          id: `issue_agent_iterations_${node.id}`,
          nodeId: node.id,
          severity: 'error',
          field: 'maxIterations',
          message: `Agent node "${title}" max iterations must be at least 1.`,
          suggestion: 'Set max iterations between 1 and 20.',
        });
      }
    }

    // D. Condition / Router Node
    if (node.type === 'condition') {
      const routes = config.routes || [];
      const conditions = config.conditions || [];

      if (routes.length === 0) {
        issues.push({
          id: `issue_cond_noroutes_${node.id}`,
          nodeId: node.id,
          severity: 'error',
          field: 'routes',
          message: `Condition node "${title}" has no defined routes.`,
          suggestion: 'Add at least one named branch route.',
        });
      }

      if (conditions.length === 0) {
        issues.push({
          id: `issue_cond_noconditions_${node.id}`,
          nodeId: node.id,
          severity: 'warning',
          field: 'conditions',
          message: `Condition node "${title}" has no evaluation conditions.`,
          suggestion: 'Add conditions to route incoming requests.',
        });
      }

      // Check condition rules integrity (valid targetRouteId and sourceField)
      const validRouteIds = new Set(routes.map((r: any) => r.id));
      conditions.forEach((cond: any, cIdx: number) => {
        if (!cond.targetRouteId || !validRouteIds.has(cond.targetRouteId)) {
          issues.push({
            id: `issue_cond_invalid_target_${node.id}_${cond.id || cIdx}`,
            nodeId: node.id,
            severity: 'error',
            field: 'targetRouteId',
            message: `Condition Rule #${cIdx + 1} in "${title}" targets an unknown route ("${cond.targetRouteId}").`,
            suggestion: `Reassign Rule #${cIdx + 1} to one of the defined routes: [${routes.map((r: any) => r.label).join(', ')}].`,
          });
        }
        if (!cond.sourceField?.trim()) {
          issues.push({
            id: `issue_cond_empty_field_${node.id}_${cond.id || cIdx}`,
            nodeId: node.id,
            severity: 'error',
            field: 'sourceField',
            message: `Condition Rule #${cIdx + 1} in "${title}" has an empty source field.`,
            suggestion: 'Specify which state variable (e.g. agent_output or user_message) to evaluate.',
          });
        }
      });

      // Check if default fallback route is valid
      if (config.defaultRoute && !validRouteIds.has(config.defaultRoute) && config.defaultRoute !== 'fallback') {
        issues.push({
          id: `issue_cond_invalid_default_${node.id}`,
          nodeId: node.id,
          severity: 'warning',
          field: 'defaultRoute',
          message: `Fallback route "${config.defaultRoute}" in "${title}" is not recognized among defined routes.`,
          suggestion: 'Select a valid fallback route from defined branch routes.',
        });
      }

      // Check if all routes have outgoing edges
      const nodeOutEdges = edges.filter((e) => e.source === node.id);
      routes.forEach((route: any) => {
        const hasEdge = nodeOutEdges.some(
          (e) => e.sourceHandle === route.id || e.label === route.label,
        );
        if (!hasEdge && nodeOutEdges.length < routes.length) {
          issues.push({
            id: `issue_cond_unrouted_${node.id}_${route.id}`,
            nodeId: node.id,
            severity: 'warning',
            message: `Route "${route.label}" on condition node "${title}" has no connected branch edge.`,
            suggestion: 'Connect an edge from this condition node to the target branch.',
          });
        }
      });
    }

    // E. HTTP Request Node
    if (node.type === 'http_request') {
      if (!config.url?.trim()) {
        issues.push({
          id: `issue_http_nourl_${node.id}`,
          nodeId: node.id,
          severity: 'error',
          field: 'url',
          message: `HTTP Request node "${title}" has no target URL configured.`,
          suggestion: 'Provide a valid HTTPS endpoint URL.',
        });
      } else if (!/^https?:\/\//i.test(config.url.trim())) {
        issues.push({
          id: `issue_http_invalid_url_${node.id}`,
          nodeId: node.id,
          severity: 'error',
          field: 'url',
          message: `HTTP Request node "${title}" URL must begin with http:// or https://.`,
          suggestion: 'Use a secure HTTPS URL.',
        });
      }
    }

    // F. Transform Node
    if (node.type === 'transform') {
      const assignments = config.assignments || [];
      if (assignments.length === 0) {
        issues.push({
          id: `issue_trans_noassign_${node.id}`,
          nodeId: node.id,
          severity: 'warning',
          field: 'assignments',
          message: `Transform node "${title}" has no state assignments defined.`,
          suggestion: 'Define at least one variable assignment or output mapping.',
        });
      }
    }

    // G. Structured Output Node
    if (node.type === 'structured_output') {
      if (!config.outputSchema?.trim()) {
        issues.push({
          id: `issue_schema_empty_${node.id}`,
          nodeId: node.id,
          severity: 'error',
          field: 'outputSchema',
          message: `Structured Output node "${title}" has an empty JSON Schema.`,
          suggestion: 'Define the JSON Schema for required output fields.',
        });
      } else {
        try {
          JSON.parse(config.outputSchema);
        } catch {
          issues.push({
            id: `issue_schema_invalid_${node.id}`,
            nodeId: node.id,
            severity: 'error',
            field: 'outputSchema',
            message: `Structured Output node "${title}" contains invalid JSON Schema syntax.`,
            suggestion: 'Fix JSON syntax errors in the schema editor.',
          });
        }
      }
    }

    // H. Secret Leakage Detection
    const rawConfigString = JSON.stringify(config);
    const secretPattern = /(?:sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{20,}|xoxb-[a-zA-Z0-9]{10,})/i;
    if (secretPattern.test(rawConfigString)) {
      issues.push({
        id: `issue_secret_leak_${node.id}`,
        nodeId: node.id,
        severity: 'error',
        message: `Potential hardcoded secret or API key detected in node "${title}".`,
        suggestion: 'Never embed raw API keys in workflow JSON. Use credential references like env:OPENAI_API_KEY.',
      });
    }
  });

  // 6. Cycle & Loop Detection
  const hasCycle = detectCycles(nodes.map((n) => n.id), edges);
  if (hasCycle) {
    issues.push({
      id: 'issue_graph_cycle',
      severity: 'error',
      message: 'Unsupported infinite cycle or unbounded loop detected in the graph.',
      suggestion: 'Ensure connections form a directed acyclic graph (DAG) or use bounded agent iterations.',
    });
  }

  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;
  const infos = issues.filter((i) => i.severity === 'info').length;

  return {
    isValid: errors === 0,
    canExecute: errors === 0,
    canPublish: errors === 0,
    issues,
    summary: {
      errors,
      warnings,
      infos,
    },
  };
}

/**
 * Cycle detection using standard DFS with visiting/visited recursion stack.
 */
function detectCycles(nodeIds: string[], edges: Array<{ source: string; target: string }>): boolean {
  const adj = new Map<string, string[]>();
  nodeIds.forEach((id) => adj.set(id, []));
  edges.forEach((e) => {
    if (adj.has(e.source)) {
      adj.get(e.source)!.push(e.target);
    }
  });

  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(curr: string): boolean {
    visited.add(curr);
    inStack.add(curr);

    const neighbors = adj.get(curr) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (inStack.has(neighbor)) {
        return true;
      }
    }

    inStack.delete(curr);
    return false;
  }

  for (const id of nodeIds) {
    if (!visited.has(id)) {
      if (dfs(id)) return true;
    }
  }

  return false;
}
