import { useState, useRef, type MouseEvent, useEffect } from 'react';
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
  Compass,
} from 'lucide-react';
import { useProject, useUpdateProject } from '../hooks/useProjects';
import type {
  WorkflowNode,
  WorkflowEdge,
  WorkflowGraph,
  NodeType,
} from '../types/workflow';

// ── Default starter workflow if project has no graph yet ─────────────
const DEFAULT_INITIAL_GRAPH: WorkflowGraph = {
  name: 'Agent Workflow',
  version: '0.1.0',
  status: 'DRAFT',
  nodes: [
    {
      id: 'node-start',
      type: 'start',
      title: 'Receive Message',
      position: { x: 380, y: 50 },
      data: {
        label: 'Receive message',
        sublabel: '01 / START',
        description: 'message · conversation_id',
      },
    },
    {
      id: 'node-llm',
      type: 'agent',
      title: 'Knowledge Agent',
      position: { x: 360, y: 190 },
      data: {
        label: 'Knowledge Agent',
        sublabel: '02 / AGENT',
        description: 'GPT-4o mini · temp 0.3',
        model: 'gpt-4o-mini',
        systemPrompt:
          'You are a helpful customer concierge. Use knowledge base and respond politely.',
      },
    },
    {
      id: 'node-tool',
      type: 'tool',
      title: 'Docs Search',
      position: { x: 670, y: 190 },
      data: {
        label: 'Documentation Search',
        sublabel: 'TOOL',
        description: 'Vector DB · top 3 chunks',
        toolType: 'knowledge_base',
      },
    },
    {
      id: 'node-condition',
      type: 'condition',
      title: 'Confidence Check',
      position: { x: 360, y: 340 },
      data: {
        label: 'Confidence Check',
        sublabel: '03 / CONDITION',
        description: 'confidence >= 0.80',
        conditionExpr: 'confidence >= 0.80',
      },
    },
    {
      id: 'node-end-success',
      type: 'end',
      title: 'Return Answer',
      position: { x: 220, y: 490 },
      data: {
        label: 'Return answer',
        sublabel: '04 / END',
        description: 'response = answer',
      },
    },
    {
      id: 'node-end-handoff',
      type: 'end',
      title: 'Human Handoff',
      position: { x: 500, y: 490 },
      data: {
        label: 'Human handoff',
        sublabel: '05 / END',
        description: 'response = handoff_message',
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'node-start', target: 'node-llm' },
    { id: 'e2', source: 'node-llm', target: 'node-tool' },
    { id: 'e3', source: 'node-llm', target: 'node-condition' },
    {
      id: 'e4',
      source: 'node-condition',
      target: 'node-end-success',
      label: 'TRUE · confident',
    },
    {
      id: 'e5',
      source: 'node-condition',
      target: 'node-end-handoff',
      label: 'FALSE · needs help',
    },
  ],
};

// ── Preset AI Templates that Copilot can generate ───────────────────
const TEMPLATES: Record<string, { label: string; graph: WorkflowGraph }> = {
  support: {
    label: 'Customer Support Concierge',
    graph: DEFAULT_INITIAL_GRAPH,
  },
  researcher: {
    label: 'Multi-Step Research Agent',
    graph: {
      name: 'Deep Research Agent',
      version: '1.0.0',
      status: 'DRAFT',
      nodes: [
        {
          id: 'n-start',
          type: 'start',
          title: 'User Query',
          position: { x: 350, y: 50 },
          data: { label: 'User Research Query', sublabel: '01 / START' },
        },
        {
          id: 'n-planner',
          type: 'agent',
          title: 'Planning Agent',
          position: { x: 330, y: 180 },
          data: {
            label: 'Query Planner',
            sublabel: '02 / AGENT',
            model: 'gpt-4o',
            systemPrompt: 'Decompose user research topic into search queries.',
          },
        },
        {
          id: 'n-tool',
          type: 'tool',
          title: 'Web Search',
          position: { x: 620, y: 180 },
          data: {
            label: 'Live Web Search',
            sublabel: 'TOOL',
            toolType: 'web_search',
          },
        },
        {
          id: 'n-writer',
          type: 'llm',
          title: 'Synthesis Agent',
          position: { x: 330, y: 320 },
          data: {
            label: 'Report Synthesizer',
            sublabel: '03 / LLM',
            model: 'claude-3-5-sonnet',
          },
        },
        {
          id: 'n-end',
          type: 'end',
          title: 'Final Report',
          position: { x: 350, y: 460 },
          data: { label: 'Deliver Report', sublabel: '04 / END' },
        },
      ],
      edges: [
        { id: 're1', source: 'n-start', target: 'n-planner' },
        { id: 're2', source: 'n-planner', target: 'n-tool' },
        { id: 're3', source: 'n-planner', target: 'n-writer' },
        { id: 're4', source: 'n-writer', target: 'n-end' },
      ],
    },
  },
};

export default function ProjectStudioPage() {
  const { id: projectId = '' } = useParams<{ id: string }>();
  const { data: project, isLoading } = useProject(projectId);
  const updateProjectMutation = useUpdateProject();

  // Workflow State (Live synchronized with visual canvas)
  const [graph, setGraph] = useState<WorkflowGraph>(DEFAULT_INITIAL_GRAPH);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [isCopilotOpen, setIsCopilotOpen] = useState(true);
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isConnectingFrom, setIsConnectingFrom] = useState<string | null>(null);

  // Editable Project Name State
  const [projectName, setProjectName] = useState('Untitled Project');
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  useEffect(() => {
    if (project?.name) {
      setProjectName(project.name);
    }
    // If project has existing workflow graph saved in DB, load it
    if (project?.workflows?.[0]?.graph) {
      try {
        const loaded = project.workflows[0].graph as unknown as WorkflowGraph;
        if (loaded.nodes && loaded.edges) {
          setGraph(loaded);
        }
      } catch {
        // fallback to default starter
      }
    }
  }, [project]);

  // Handle Project Name Update
  const handleSaveTitle = () => {
    setIsEditingTitle(false);
    if (projectName.trim() && projectName !== project?.name) {
      updateProjectMutation.mutate({
        id: projectId,
        data: { name: projectName.trim() },
      });
    }
  };

  // ── Drag & Drop canvas node tracking ────────────────────────────────
  const canvasRef = useRef<HTMLDivElement>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleNodeMouseDown = (e: MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
    setDraggingNodeId(nodeId);

    const targetNode = graph.nodes.find((n) => n.id === nodeId);
    if (targetNode) {
      setDragOffset({
        x: e.clientX - targetNode.position.x,
        y: e.clientY - targetNode.position.y,
      });
    }
  };

  const handleCanvasMouseMove = (e: MouseEvent) => {
    if (!draggingNodeId) return;

    const scale = zoom / 100;
    const newX = Math.round((e.clientX - dragOffset.x) / scale);
    const newY = Math.round((e.clientY - dragOffset.y) / scale);

    setGraph((prev) => ({
      ...prev,
      nodes: prev.nodes.map((node) =>
        node.id === draggingNodeId
          ? { ...node, position: { x: Math.max(20, newX), y: Math.max(20, newY) } }
          : node,
      ),
    }));
  };

  const handleCanvasMouseUp = () => {
    setDraggingNodeId(null);
  };

  // ── Node & Edge Operations ──────────────────────────────────────────
  const handleAddNode = (type: NodeType) => {
    const newId = `node-${type}-${Date.now().toString().slice(-4)}`;
    const titles: Record<NodeType, string> = {
      start: 'Input Trigger',
      agent: 'Autonomous Agent',
      llm: 'Model Prompt',
      tool: 'Custom Tool',
      condition: 'Condition Router',
      human: 'Human Review',
      end: 'Return Output',
    };

    const newNode: WorkflowNode = {
      id: newId,
      type,
      title: titles[type],
      position: { x: 360, y: 250 },
      data: {
        label: titles[type],
        sublabel: type.toUpperCase(),
        description: `${type} node configuration`,
        ...(type === 'agent' && { model: 'gpt-4o-mini', temperature: 0.3 }),
        ...(type === 'tool' && { toolType: 'web_search' }),
        ...(type === 'condition' && { conditionExpr: 'score >= 0.7' }),
      },
    };

    setGraph((prev) => ({
      ...prev,
      nodes: [...prev.nodes, newNode],
    }));
    setSelectedNodeId(newId);
  };

  const handleDeleteSelected = () => {
    if (selectedNodeId) {
      setGraph((prev) => ({
        ...prev,
        nodes: prev.nodes.filter((n) => n.id !== selectedNodeId),
        edges: prev.edges.filter(
          (e) => e.source !== selectedNodeId && e.target !== selectedNodeId,
        ),
      }));
      setSelectedNodeId(null);
    } else if (selectedEdgeId) {
      setGraph((prev) => ({
        ...prev,
        edges: prev.edges.filter((e) => e.id !== selectedEdgeId),
      }));
      setSelectedEdgeId(null);
    }
  };

  const handleConnectNodes = (targetId: string) => {
    if (!isConnectingFrom || isConnectingFrom === targetId) {
      setIsConnectingFrom(null);
      return;
    }

    const newEdgeId = `e-${isConnectingFrom}-${targetId}-${Date.now()
      .toString()
      .slice(-4)}`;
    const sourceNode = graph.nodes.find((n) => n.id === isConnectingFrom);

    const newEdge: WorkflowEdge = {
      id: newEdgeId,
      source: isConnectingFrom,
      target: targetId,
      ...(sourceNode?.type === 'condition' && { label: 'BRANCH' }),
    };

    setGraph((prev) => ({
      ...prev,
      edges: [...prev.edges, newEdge],
    }));
    setIsConnectingFrom(null);
  };

  // ── Copilot Chat State ──────────────────────────────────────────────
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
      id: 'm1',
      role: 'assistant',
      content:
        'Hello! I am your AI agent copilot. You can describe your workflow in plain English or select a template, and I will generate the visual graph logic on your canvas.',
      timestamp: new Date(),
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  const handleSendMessage = () => {
    if (!chatInput.trim() || isAiGenerating) return;

    const userText = chatInput.trim();
    setChatInput('');

    const userMsgId = `usr-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        role: 'user',
        content: userText,
        timestamp: new Date(),
      },
    ]);

    setIsAiGenerating(true);

    // Simulate AI synthesis of graph JSON from prompt
    setTimeout(() => {
      const isResearch =
        userText.toLowerCase().includes('research') ||
        userText.toLowerCase().includes('web') ||
        userText.toLowerCase().includes('search');

      const templateToUse = isResearch
        ? TEMPLATES.researcher.graph
        : TEMPLATES.support.graph;

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: `I have synthesized a workflow graph based on: "${userText}". It defines the start trigger, intelligent agent logic with model configs, tool attachments, and outcomes. Click below to apply it to your canvas:`,
          suggestedGraph: templateToUse,
          timestamp: new Date(),
        },
      ]);
      setIsAiGenerating(false);
    }, 1200);
  };

  const handleApplyGraph = (newGraph: WorkflowGraph) => {
    setGraph(newGraph);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(graph, null, 2));
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const selectedNode = graph.nodes.find((n) => n.id === selectedNodeId);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        <div className="flex items-center gap-2.5 text-sm">
          <Loader2 className="size-4 animate-spin text-white" />
          Loading project studio…
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-neutral-900 font-sans text-neutral-100 antialiased">
      {/* ── Top Header Toolbar ────────────────────────────────────────── */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-800 bg-neutral-950 px-4">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-neutral-400 no-underline transition-colors hover:bg-neutral-800 hover:text-white"
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
              className="rounded bg-neutral-800 px-2 py-0.5 text-sm font-semibold text-white focus:outline-none focus:ring-1 focus:ring-neutral-400"
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingTitle(true)}
              className="text-sm font-semibold text-white hover:underline"
              title="Click to rename"
            >
              {projectName}
            </button>
          )}

          <span className="rounded bg-neutral-800 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-neutral-400">
            {graph.status}
          </span>
        </div>

        {/* Center Canvas Quick Node Insert Palette */}
        <div className="hidden items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/90 p-1 md:flex">
          <button
            type="button"
            onClick={() => handleAddNode('agent')}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white"
          >
            <Bot className="size-3.5 text-brand-400" />
            + Agent
          </button>
          <button
            type="button"
            onClick={() => handleAddNode('tool')}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white"
          >
            <Wrench className="size-3.5 text-amber-400" />
            + Tool
          </button>
          <button
            type="button"
            onClick={() => handleAddNode('condition')}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white"
          >
            <Compass className="size-3.5 text-sky-400" />
            + Condition
          </button>
          <button
            type="button"
            onClick={() => handleAddNode('llm')}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white"
          >
            <Cpu className="size-3.5 text-purple-400" />
            + LLM
          </button>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2.5">
          {/* JSON Graph View Button */}
          <button
            type="button"
            onClick={() => setIsJsonModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white"
          >
            <Code2 className="size-3.5" />
            JSON Graph
          </button>

          {/* Toggle AI Copilot */}
          <button
            type="button"
            onClick={() => setIsCopilotOpen((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              isCopilotOpen
                ? 'bg-brand-600 text-white shadow-xs'
                : 'border border-neutral-800 bg-neutral-900 text-neutral-300 hover:bg-neutral-800'
            }`}
          >
            <Sparkles className="size-3.5" />
            AI Copilot
          </button>

          {/* Save Draft */}
          <button
            type="button"
            onClick={() => {
              alert('Workflow graph saved to project draft.');
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-1.5 text-xs font-semibold text-neutral-900 shadow-xs transition-all hover:bg-neutral-200"
          >
            <Save className="size-3.5" />
            Save
          </button>
        </div>
      </header>

      {/* ── Main Workspace: Split Canvas & Copilot ─────────────────────── */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* ── Left / Center Canvas ──────────────────────────────────────── */}
        <div
          ref={canvasRef}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onClick={() => {
            setSelectedNodeId(null);
            setSelectedEdgeId(null);
            setIsConnectingFrom(null);
          }}
          className="relative flex-1 select-none overflow-hidden bg-[#0d0f12] cursor-crosshair"
          style={{
            backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)`,
            backgroundSize: `${20 * (zoom / 100)}px ${20 * (zoom / 100)}px`,
          }}
        >
          {/* Connecting Active Notice Banner */}
          {isConnectingFrom && (
            <div className="absolute top-4 left-1/2 z-30 -translate-x-1/2 rounded-full border border-sky-500/40 bg-sky-950/90 px-4 py-1.5 text-xs font-medium text-sky-200 shadow-lg backdrop-blur-md">
              Click another node to connect line · Press Esc to cancel
            </div>
          )}

          {/* SVG Connecting Edges Layer */}
          <svg className="pointer-events-none absolute inset-0 size-full">
            <defs>
              <marker
                id="arrow"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 8 5 L 0 9 z" fill="#71717a" />
              </marker>
              <marker
                id="arrow-active"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 8 5 L 0 9 z" fill="#60a5fa" />
              </marker>
            </defs>

            {graph.edges.map((edge) => {
              const srcNode = graph.nodes.find((n) => n.id === edge.source);
              const tgtNode = graph.nodes.find((n) => n.id === edge.target);
              if (!srcNode || !tgtNode) return null;

              const isSelected = selectedEdgeId === edge.id;

              // Node dimensions approx 220w x 80h
              const sx = srcNode.position.x + 110;
              const sy = srcNode.position.y + 75;
              const tx = tgtNode.position.x + 110;
              const ty = tgtNode.position.y;

              const midY = (sy + ty) / 2;
              const pathD = `M ${sx} ${sy} C ${sx} ${midY}, ${tx} ${midY}, ${tx} ${ty}`;

              return (
                <g key={edge.id} className="pointer-events-auto">
                  {/* Invisible thicker stroke for easy clicking */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={16}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEdgeId(edge.id);
                      setSelectedNodeId(null);
                    }}
                    className="cursor-pointer"
                  />
                  {/* Visual Edge Path */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={isSelected ? '#60a5fa' : '#52525b'}
                    strokeWidth={isSelected ? 2.5 : 1.75}
                    markerEnd={isSelected ? 'url(#arrow-active)' : 'url(#arrow)'}
                    className="transition-colors"
                  />

                  {/* Edge Condition Label Badge if defined */}
                  {edge.label && (
                    <foreignObject
                      x={(sx + tx) / 2 - 60}
                      y={midY - 12}
                      width={120}
                      height={24}
                      className="pointer-events-none overflow-visible"
                    >
                      <div className="flex justify-center">
                        <span className="rounded-full border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-[9px] font-mono tracking-wider text-neutral-300 shadow-md">
                          {edge.label}
                        </span>
                      </div>
                    </foreignObject>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Interactive Graph Nodes */}
          {graph.nodes.map((node) => {
            const isSelected = selectedNodeId === node.id;
            const isConnecting = isConnectingFrom === node.id;

            return (
              <div
                key={node.id}
                onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isConnectingFrom && isConnectingFrom !== node.id) {
                    handleConnectNodes(node.id);
                  } else {
                    setSelectedNodeId(node.id);
                    setSelectedEdgeId(null);
                  }
                }}
                style={{
                  transform: `translate(${node.position.x}px, ${node.position.y}px)`,
                }}
                className={`absolute w-56 rounded-xl border p-3.5 shadow-lg transition-all cursor-move select-none ${
                  isSelected
                    ? 'border-white bg-neutral-900 shadow-white/5 ring-2 ring-white/20'
                    : isConnecting
                    ? 'border-sky-400 bg-neutral-900 ring-2 ring-sky-400/30'
                    : 'border-neutral-800 bg-neutral-900/95 hover:border-neutral-700'
                }`}
              >
                {/* Node Type Top Label */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                    {node.data.sublabel || node.type}
                  </span>

                  {/* Connect Handle Button */}
                  <button
                    type="button"
                    title="Connect edge"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsConnectingFrom(node.id);
                    }}
                    className="flex size-4 items-center justify-center rounded-full bg-neutral-800 text-[10px] text-neutral-400 hover:bg-neutral-700 hover:text-white"
                  >
                    +
                  </button>
                </div>

                {/* Node Title */}
                <div className="mt-1 text-xs font-bold text-white">
                  {node.title}
                </div>

                {/* Node Description/Metadata */}
                <div className="mt-0.5 text-[11px] font-mono text-neutral-400 truncate">
                  {node.data.description || node.data.model || 'No config'}
                </div>

                {/* Visual badge icons based on node type */}
                <div className="mt-2.5 flex items-center justify-between border-t border-neutral-800/80 pt-2 text-[10px] text-neutral-500">
                  <span className="capitalize">{node.type}</span>
                  {node.type === 'agent' && (
                    <Bot className="size-3 text-brand-400" />
                  )}
                  {node.type === 'tool' && (
                    <Wrench className="size-3 text-amber-400" />
                  )}
                  {node.type === 'condition' && (
                    <Compass className="size-3 text-sky-400" />
                  )}
                  {node.type === 'end' && (
                    <CheckCircle2 className="size-3 text-emerald-400" />
                  )}
                </div>
              </div>
            );
          })}

          {/* Bottom Left Canvas Controls */}
          <div className="absolute bottom-5 left-5 z-20 flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-950/90 p-1 backdrop-blur-md shadow-md">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(50, z - 10))}
              className="flex size-7 items-center justify-center rounded text-neutral-400 hover:bg-neutral-800 hover:text-white"
              title="Zoom out"
            >
              <Minus className="size-3.5" />
            </button>
            <span className="px-1 font-mono text-xs text-neutral-300">
              {zoom}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(150, z + 10))}
              className="flex size-7 items-center justify-center rounded text-neutral-400 hover:bg-neutral-800 hover:text-white"
              title="Zoom in"
            >
              <Plus className="size-3.5" />
            </button>
            <div className="h-4 w-px bg-neutral-800" />
            <button
              type="button"
              onClick={() => setZoom(100)}
              className="flex size-7 items-center justify-center rounded text-neutral-400 hover:bg-neutral-800 hover:text-white"
              title="Fit View"
            >
              <Maximize2 className="size-3.5" />
            </button>
            {(selectedNodeId || selectedEdgeId) && (
              <>
                <div className="h-4 w-px bg-neutral-800" />
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  className="flex size-7 items-center justify-center rounded text-red-400 hover:bg-red-950/60 hover:text-red-300"
                  title="Delete Selected Node/Edge"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Node Properties Inspector Drawer (If Node Selected) ────────── */}
        {selectedNode && (
          <aside className="w-72 shrink-0 border-l border-neutral-800 bg-neutral-950 p-4 text-xs overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <span className="font-semibold text-white">Node Properties</span>
              <button
                type="button"
                onClick={() => setSelectedNodeId(null)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-neutral-400">
                  Node Title
                </label>
                <input
                  type="text"
                  value={selectedNode.title}
                  onChange={(e) => {
                    const val = e.target.value;
                    setGraph((prev) => ({
                      ...prev,
                      nodes: prev.nodes.map((n) =>
                        n.id === selectedNode.id
                          ? { ...n, title: val, data: { ...n.data, label: val } }
                          : n,
                      ),
                    }));
                  }}
                  className="mt-1 w-full rounded border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-neutral-500"
                />
              </div>

              {selectedNode.type === 'agent' && (
                <>
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-400">
                      Model
                    </label>
                    <select
                      value={selectedNode.data.model || 'gpt-4o-mini'}
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
                                    model: val,
                                    description: `${val} · temp 0.3`,
                                  },
                                }
                              : n,
                          ),
                        }));
                      }}
                      className="mt-1 w-full rounded border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-xs text-white focus:outline-none"
                    >
                      <option value="gpt-4o-mini">GPT-4o Mini</option>
                      <option value="gpt-4o">GPT-4o</option>
                      <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                      <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-neutral-400">
                      System Instructions
                    </label>
                    <textarea
                      rows={4}
                      value={selectedNode.data.systemPrompt || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setGraph((prev) => ({
                          ...prev,
                          nodes: prev.nodes.map((n) =>
                            n.id === selectedNode.id
                              ? {
                                  ...n,
                                  data: { ...n.data, systemPrompt: val },
                                }
                              : n,
                          ),
                        }));
                      }}
                      placeholder="Define the agent behavior and guardrails..."
                      className="mt-1 w-full rounded border border-neutral-800 bg-neutral-900 p-2 text-xs text-white focus:outline-none focus:border-neutral-500"
                    />
                  </div>
                </>
              )}

              {selectedNode.type === 'condition' && (
                <div>
                  <label className="block text-[11px] font-medium text-neutral-400">
                    Routing Expression
                  </label>
                  <input
                    type="text"
                    value={selectedNode.data.conditionExpr || ''}
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
                                  conditionExpr: val,
                                  description: val,
                                },
                              }
                            : n,
                        ),
                      }));
                    }}
                    placeholder="e.g. confidence >= 0.80"
                    className="mt-1 w-full rounded border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  />
                </div>
              )}

              {selectedNode.type === 'tool' && (
                <div>
                  <label className="block text-[11px] font-medium text-neutral-400">
                    Tool Provider
                  </label>
                  <select
                    value={selectedNode.data.toolType || 'web_search'}
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
                                  toolType: val,
                                  description: val,
                                },
                              }
                            : n,
                        ),
                      }));
                    }}
                    className="mt-1 w-full rounded border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  >
                    <option value="web_search">Tavily / Google Search</option>
                    <option value="knowledge_base">Vector DB Retrieval</option>
                    <option value="code_exec">Code Interpreter</option>
                    <option value="custom_api">Custom REST API</option>
                  </select>
                </div>
              )}

              <button
                type="button"
                onClick={handleDeleteSelected}
                className="mt-4 w-full rounded border border-red-500/30 bg-red-950/20 py-1.5 text-xs font-medium text-red-400 hover:bg-red-950/40"
              >
                Delete Node
              </button>
            </div>
          </aside>
        )}

        {/* ── AI Copilot Right Drawer (ChatGPT-Style Window) ──────────── */}
        {isCopilotOpen && (
          <aside className="flex w-96 shrink-0 flex-col border-l border-neutral-800 bg-neutral-950 text-xs">
            {/* Copilot Header */}
            <div className="flex h-12 items-center justify-between border-b border-neutral-800 px-4">
              <div className="flex items-center gap-2">
                <div className="flex size-5 items-center justify-center rounded bg-brand-500 text-white">
                  <Sparkles className="size-3" />
                </div>
                <span className="font-semibold text-white">AI Copilot</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setMessages([
                      {
                        id: `m-init`,
                        role: 'assistant',
                        content:
                          'New conversation started. What workflow would you like to build?',
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

            {/* Quick Templates Buttons */}
            <div className="border-b border-neutral-800/80 bg-neutral-900/50 p-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                Suggested Blueprints
              </span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => handleApplyGraph(TEMPLATES.support.graph)}
                  className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-[11px] text-neutral-300 hover:border-neutral-700 hover:text-white"
                >
                  Support Concierge
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyGraph(TEMPLATES.researcher.graph)}
                  className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-[11px] text-neutral-300 hover:border-neutral-700 hover:text-white"
                >
                  Research Agent
                </button>
              </div>
            </div>

            {/* Chat Thread Messages */}
            <div className="flex-1 space-y-3.5 overflow-y-auto p-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-3.5 py-2.5 leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-brand-600 text-white'
                        : 'border border-neutral-800 bg-neutral-900 text-neutral-200 shadow-xs'
                    }`}
                  >
                    <p>{msg.content}</p>

                    {/* Action button to apply generated graph */}
                    {msg.suggestedGraph && (
                      <div className="mt-3 pt-2.5 border-t border-neutral-800">
                        <button
                          type="button"
                          onClick={() => handleApplyGraph(msg.suggestedGraph!)}
                          className="inline-flex items-center gap-1.5 rounded bg-white px-2.5 py-1 font-semibold text-neutral-950 hover:bg-neutral-200"
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
                  Generating workflow logic…
                </div>
              )}
            </div>

            {/* Chat Input Field */}
            <div className="border-t border-neutral-800 p-3">
              <div className="relative">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Describe your agent workflow..."
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-900 py-2.5 pl-3 pr-9 text-xs text-white placeholder-neutral-500 focus:border-neutral-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={!chatInput.trim() || isAiGenerating}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white disabled:opacity-40"
                >
                  <Send className="size-3.5" />
                </button>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* ── JSON Graph Viewer Modal ────────────────────────────────────── */}
      {isJsonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-neutral-800 bg-neutral-950 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <Code2 className="size-4 text-brand-400" />
                <h3 className="text-sm font-bold text-white">
                  Synchronized Graph JSON State
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="inline-flex items-center gap-1 rounded bg-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-300 hover:bg-neutral-700 hover:text-white"
                >
                  {isCopied ? (
                    <>
                      <Check className="size-3 text-emerald-400" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="size-3" />
                      Copy JSON
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsJsonModalOpen(false)}
                  className="text-neutral-400 hover:text-white"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <pre className="mt-4 flex-1 overflow-auto rounded-xl border border-neutral-900 bg-black/70 p-4 font-mono text-[11px] leading-relaxed text-emerald-400">
              {JSON.stringify(graph, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
