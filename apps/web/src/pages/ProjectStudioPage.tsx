import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  type MouseEvent,
  type WheelEvent,
  type DragEvent,
} from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
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
  Check,
  Copy,
  RefreshCw,
  Rocket,
  Undo2,
  Redo2,
  ChevronDown,
  X,
} from 'lucide-react';
import { useProject, useUpdateProject } from '../hooks/useProjects';
import {
  useWorkflows,
  useCreateWorkflow,
  useUpdateWorkflow,
  useMakeLiveWorkflow,
} from '../hooks/useWorkflows';
import type { WorkflowItem } from '../lib/api';
import type {
  WorkflowNode,
  WorkflowEdge,
  WorkflowGraph,
  CoreNodeType,
  ValidationIssue,
} from '../types/workflow';
import { NODE_REGISTRY } from '../lib/workflow/registry';
import {
  deserializeFromCanonical,
  serializeToCanonical,
  createDefaultCanonicalWorkflow,
} from '../lib/workflow/canonical';
import { validateWorkflow } from '../lib/workflow/validation';
import { generateWorkflowFromPrompt } from '../lib/workflow/copilot';
import { NodeLibrary } from '../components/workflow/NodeLibrary';
import { PropertiesPanel } from '../components/workflow/PropertiesPanel';
import { ValidationPanel } from '../components/workflow/ValidationPanel';
import { TestPanel } from '../components/workflow/TestPanel';
import { PublishModal } from '../components/workflow/PublishModal';
import { CanvasMinimap } from '../components/workflow/CanvasMinimap';
import { JsonModal } from '../components/workflow/JsonModal';

// ── Node Dimension Constants ──────────────────────────────────────────
export const NODE_WIDTH = 240;
export const NODE_HEIGHT = 92;

export default function ProjectStudioPage() {
  const { id: projectId = '' } = useParams<{ id: string }>();
  const { data: project } = useProject(projectId);
  const updateProjectMutation = useUpdateProject();

  // Workflows Query & Mutations
  const workflowsQuery = useWorkflows(projectId);
  const workflows = useMemo(() => workflowsQuery.data || [], [workflowsQuery.data]);
  const createWorkflowMutation = useCreateWorkflow();
  const updateWorkflowMutation = useUpdateWorkflow();
  const makeLiveMutation = useMakeLiveWorkflow();

  // Active Version & Notifications
  const [currentVersion, setCurrentVersion] = useState<string>('1.0.0');
  const [isVersionDropdownOpen, setIsVersionDropdownOpen] = useState(false);
  const [isSaveMenuOpen, setIsSaveMenuOpen] = useState(false);
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);
  const initialLoadedRef = useRef(false);

  const currentWf = useMemo(
    () => workflows.find((w) => w.version === currentVersion) || workflows[0],
    [workflows, currentVersion],
  );

  // Workflow State & Undo/Redo History
  const [graph, setGraph] = useState<WorkflowGraph>(() =>
    deserializeFromCanonical(createDefaultCanonicalWorkflow()),
  );
  const [history, setHistory] = useState<WorkflowGraph[]>([]);
  const [future, setFuture] = useState<WorkflowGraph[]>([]);

  // Selection & Connection State
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<{
    nodeId: string;
    handleId?: string;
    handleLabel?: string;
  } | null>(null);

  // Pan & Zoom Viewport
  const [pan, setPan] = useState({ x: 120, y: 40 });
  const [zoom, setZoom] = useState(1.0);
  const [viewportSize, setViewportSize] = useState({ width: 1200, height: 800 });

  // Drawers & Modals
  const [isLibraryOpen, setIsLibraryOpen] = useState(true);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const [isValidationOpen, setIsValidationOpen] = useState(false);
  const [isTestPanelOpen, setIsTestPanelOpen] = useState(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);

  // Highlighting during testing
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);

  // Project Title & Status
  const [projectName, setProjectName] = useState('Customer Support Agent');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // AI Copilot Chat State
  const [chatInput, setChatInput] = useState('');
  const [isCopilotGenerating, setIsCopilotGenerating] = useState(false);
  const [copilotMessages, setCopilotMessages] = useState<
    Array<{
      id: string;
      role: 'user' | 'assistant';
      content: string;
      suggestedGraph?: WorkflowGraph;
      highlights?: string[];
    }>
  >([
    {
      id: 'init_copilot',
      role: 'assistant',
      content:
        'Hello! I can architect and generate AI workflows for you. Describe your goal (e.g. "Create a customer refund triage agent with API lookup") or pick a template.',
    },
  ]);

  // Canvas Drag & Pan Tracking Refs
  const canvasRef = useRef<HTMLDivElement>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const draggingNodeIdRef = useRef<string | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Update Viewport Size on Resize
  useEffect(() => {
    function updateSize() {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        setViewportSize({ width: rect.width, height: rect.height });
      }
    }
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Update Graph with History Push
  const updateGraphWithHistory = useCallback(
    (updater: (prev: WorkflowGraph) => WorkflowGraph) => {
      setGraph((prev) => {
        const next = updater(prev);
        setHistory((hist) => [...hist.slice(-25), prev]);
        setFuture([]);
        return next;
      });
    },
    [],
  );

  // Undo / Redo
  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory((hist) => hist.slice(0, -1));
    setFuture((fut) => [graph, ...fut]);
    setGraph(previous);
  }, [history, graph]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture((fut) => fut.slice(1));
    setHistory((hist) => [...hist, graph]);
    setGraph(next);
  }, [future, graph]);

  // Sync Project Name when project loads
  useEffect(() => {
    if (project?.name) {
      setProjectName(project.name);
    }
  }, [project?.name]);

  // Load Initial Workflow from Backend or LocalStorage (run once on mount/data ready)
  useEffect(() => {
    if (initialLoadedRef.current) return;
    if (!projectId) return;
    if (workflowsQuery.isLoading) return;

    initialLoadedRef.current = true;

    if (workflows.length > 0) {
      // Prefer LIVE workflow, otherwise latest created workflow
      const live = workflows.find((w) => w.isLive);
      const target = live || workflows[0];
      if (target) {
        setCurrentVersion(target.version);
        if (target.graph) {
          try {
            if (target.graph.schemaVersion === '1.0.0') {
              setGraph(deserializeFromCanonical(target.graph));
              return;
            } else if (target.graph.nodes && target.graph.edges) {
              setGraph(target.graph);
              return;
            }
          } catch (err) {
            console.error('Failed to parse workflow graph', err);
          }
        }
      }
    }

    if (project?.workflows?.[0]?.graph) {
      try {
        const loaded = project.workflows[0].graph as any;
        if (loaded.nodes && loaded.edges) {
          if (loaded.schemaVersion === '1.0.0') {
            setGraph(deserializeFromCanonical(loaded));
          } else {
            setGraph(loaded);
          }
          return;
        }
      } catch {
        // fallback
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
  }, [workflowsQuery.isLoading, workflows, project?.workflows, projectId]);

  // Autosave Draft to LocalStorage with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(`quickgent_workflow_${projectId}`, JSON.stringify(graph));
      } catch {
        // ignore
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [graph, projectId]);

  // Validation
  const validation = useMemo(() => validateWorkflow(graph), [graph]);
  const selectedNode = useMemo(
    () => graph.nodes.find((n) => n.id === selectedNodeId) || null,
    [graph.nodes, selectedNodeId],
  );

  // Fit View
  const handleFitView = useCallback(() => {
    if (graph.nodes.length === 0 || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const padding = 80;

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

  // Node Management Handlers
  const handleAddNode = (type: CoreNodeType, dropPos?: { x: number; y: number }) => {
    const reg = NODE_REGISTRY[type];
    const newId = `node_${type}_${Date.now().toString().slice(-4)}`;

    let posX = 380;
    let posY = 240;

    if (dropPos) {
      posX = dropPos.x;
      posY = dropPos.y;
    } else if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      posX = Math.round((rect.width / 2 - pan.x) / zoom - NODE_WIDTH / 2);
      posY = Math.round((rect.height / 2 - pan.y) / zoom - NODE_HEIGHT / 2);
    }

    const newNode: WorkflowNode = {
      id: newId,
      type,
      title: reg.label,
      position: { x: Math.max(40, posX), y: Math.max(40, posY) },
      data: {
        label: reg.label,
        sublabel: reg.sublabel,
        description: reg.description,
        config: { ...reg.defaultConfig },
      },
    };

    updateGraphWithHistory((prev) => ({
      ...prev,
      nodes: [...prev.nodes, newNode],
    }));

    setSelectedNodeId(newId);
    setSelectedEdgeId(null);
  };

  const handleUpdateNode = (nodeId: string, updates: Partial<WorkflowNode>) => {
    setGraph((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => {
        if (n.id !== nodeId) return n;
        return {
          ...n,
          ...updates,
          data: {
            ...n.data,
            ...(updates.data || {}),
          },
        };
      }),
    }));
  };

  const handleDeleteNode = (nodeId: string) => {
    updateGraphWithHistory((prev) => ({
      ...prev,
      nodes: prev.nodes.filter((n) => n.id !== nodeId),
      edges: prev.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    }));
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
  };

  const handleDuplicateNode = (nodeId: string) => {
    const src = graph.nodes.find((n) => n.id === nodeId);
    if (!src) return;

    const newId = `node_${src.type}_${Date.now().toString().slice(-4)}`;
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
        config: JSON.parse(JSON.stringify(src.data.config || {})),
      },
    };

    updateGraphWithHistory((prev) => ({
      ...prev,
      nodes: [...prev.nodes, duplicated],
    }));
    setSelectedNodeId(newId);
  };

  // Connect Nodes
  const handleConnectNodes = (targetId: string) => {
    if (!connectingFrom || connectingFrom.nodeId === targetId) {
      setConnectingFrom(null);
      return;
    }

    const { nodeId: sourceId, handleId, handleLabel } = connectingFrom;
    setConnectingFrom(null);

    // Prevent duplicate edges
    const exists = graph.edges.some(
      (e) =>
        e.source === sourceId &&
        e.target === targetId &&
        (e.sourceHandle === handleId || (!e.sourceHandle && !handleId)),
    );
    if (exists) return;

    const newEdge: WorkflowEdge = {
      id: `e_${sourceId}_${targetId}_${Date.now().toString().slice(-4)}`,
      source: sourceId,
      target: targetId,
      sourceHandle: handleId,
      label: handleLabel,
    };

    updateGraphWithHistory((prev) => ({
      ...prev,
      edges: [...prev.edges, newEdge],
    }));
  };

  // Select and switch to a workflow version
  const handleSelectVersion = (wf: WorkflowItem) => {
    setCurrentVersion(wf.version);
    setIsVersionDropdownOpen(false);
    if (wf.graph) {
      try {
        if (wf.graph.schemaVersion === '1.0.0') {
          setGraph(deserializeFromCanonical(wf.graph));
        } else if (wf.graph.nodes && wf.graph.edges) {
          setGraph(wf.graph);
        }
        setHistory([]);
        setFuture([]);
        setNotification({
          message: `Switched canvas to v${wf.version} (${wf.isLive ? 'LIVE' : 'DRAFT'})`,
          type: 'info',
        });
        setTimeout(() => setNotification(null), 3000);
      } catch (err) {
        console.error('Failed to load version graph', err);
      }
    }
  };

  // Promote a version to LIVE
  const handleMakeLive = async (ver: string) => {
    try {
      await makeLiveMutation.mutateAsync({ projectId, version: ver });
      setNotification({
        message: `Version v${ver} is now LIVE in production!`,
        type: 'success',
      });
      setTimeout(() => setNotification(null), 4000);
    } catch (err: any) {
      setNotification({
        message: err.message || `Failed to make v${ver} LIVE`,
        type: 'error',
      });
      setTimeout(() => setNotification(null), 4000);
    }
  };

  // Publish a new release version
  const handlePublishNewVersion = async (data: {
    version: string;
    note: string;
    makeLiveImmediately: boolean;
  }) => {
    if (!validation.isValid) {
      throw new Error(
        `Cannot publish workflow version: graph has ${validation.summary.errors} validation error(s). All workflow JSON saved to the database must be valid.`,
      );
    }

    const canonical = serializeToCanonical(graph);

    await createWorkflowMutation.mutateAsync({
      projectId,
      data: {
        version: data.version,
        json: canonical,
        note: data.note,
      },
    });

    if (data.makeLiveImmediately) {
      await makeLiveMutation.mutateAsync({
        projectId,
        version: data.version,
      });
    }

    setCurrentVersion(data.version);
    setNotification({
      message: `v${data.version} saved successfully${data.makeLiveImmediately ? ' and is now LIVE!' : '!'}`,
      type: 'success',
    });
    setTimeout(() => setNotification(null), 4000);
  };

  // Save current workflow version
  const handleSaveWorkflow = async () => {
    if (!validation.isValid) {
      setSaveStatus('error');
      setIsValidationOpen(true);
      const firstError = validation.issues.find((i) => i.severity === 'error')?.message;
      setNotification({
        message: `Cannot save: ${firstError || `${validation.summary.errors} error(s) found`}. Check the Validation panel for details.`,
        type: 'error',
      });
      setTimeout(() => setSaveStatus('idle'), 5000);
      return;
    }

    setSaveStatus('saving');
    try {
      const canonical = serializeToCanonical(graph);
      try {
        localStorage.setItem(`quickgent_workflow_${projectId}`, JSON.stringify(graph));
      } catch {
        // ignore
      }

      if (projectName.trim() && projectName !== project?.name) {
        updateProjectMutation.mutate({
          id: projectId,
          data: { name: projectName.trim() },
        });
      }

      const existingWf = workflows.find((w) => w.version === currentVersion);
      if (existingWf) {
        if (existingWf.isLive) {
          // LIVE is immutable - prompt user to publish as new version
          setSaveStatus('idle');
          setIsPublishModalOpen(true);
          setNotification({
            message: `Version v${currentVersion} is LIVE and immutable. Publish as a new version to save changes.`,
            type: 'info',
          });
          setTimeout(() => setNotification(null), 5000);
          return;
        }

        await updateWorkflowMutation.mutateAsync({
          projectId,
          version: currentVersion,
          data: {
            json: canonical,
          },
        });
      } else {
        // Create initial version
        await createWorkflowMutation.mutateAsync({
          projectId,
          data: {
            version: currentVersion || '1.0.0',
            json: canonical,
            note: 'Initial version',
          },
        });
      }

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (err: any) {
      setSaveStatus('error');
      setNotification({
        message: err.message || 'Failed to save workflow',
        type: 'error',
      });
      setTimeout(() => setSaveStatus('idle'), 3000);
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
        setConnectingFrom(null);
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setIsValidationOpen(false);
        return;
      }

      if (isInput) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeId) {
          handleDeleteNode(selectedNodeId);
        } else if (selectedEdgeId) {
          updateGraphWithHistory((prev) => ({
            ...prev,
            edges: prev.edges.filter((edge) => edge.id !== selectedEdgeId),
          }));
          setSelectedEdgeId(null);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveWorkflow();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (selectedNodeId) {
          handleDuplicateNode(selectedNodeId);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        handleFitView();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, selectedEdgeId, graph, handleUndo, handleRedo, handleFitView]);

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

  const handleCanvasDrop = (e: DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/quickgent-node-type') as CoreNodeType;
    if (type && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const dropX = Math.round((e.clientX - rect.left - pan.x) / zoom - NODE_WIDTH / 2);
      const dropY = Math.round((e.clientY - rect.top - pan.y) / zoom - NODE_HEIGHT / 2);
      handleAddNode(type, { x: dropX, y: dropY });
    }
  };

  // AI Copilot Handler
  const handleSendCopilotPrompt = () => {
    if (!chatInput.trim() || isCopilotGenerating) return;
    const prompt = chatInput.trim();
    setChatInput('');

    setCopilotMessages((prev) => [
      ...prev,
      { id: `user_${Date.now()}`, role: 'user', content: prompt },
    ]);
    setIsCopilotGenerating(true);

    setTimeout(() => {
      const result = generateWorkflowFromPrompt(prompt);
      const generatedGraph = deserializeFromCanonical(result.workflow);

      setCopilotMessages((prev) => [
        ...prev,
        {
          id: `asst_${Date.now()}`,
          role: 'assistant',
          content: result.explanation,
          highlights: result.architectureHighlights,
          suggestedGraph: generatedGraph,
        },
      ]);
      setIsCopilotGenerating(false);
    }, 600);
  };

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
              onBlur={() => setIsEditingTitle(false)}
              onKeyDown={(e) => e.key === 'Enter' && setIsEditingTitle(false)}
              className="rounded-lg border border-brand-500 bg-neutral-900 px-2.5 py-1 text-sm font-semibold text-white focus:outline-none"
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

          {/* Version Selector Dropdown & Status */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsVersionDropdownOpen((v) => !v)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-mono transition-all cursor-pointer ${
                workflows.find((w) => w.version === currentVersion)?.isLive
                  ? 'border-emerald-700/60 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-950/70'
                  : 'border-neutral-800 bg-neutral-900 text-neutral-300 hover:bg-neutral-800'
              }`}
              title="Click to switch or manage workflow versions"
            >
              <span
                className={`size-2 rounded-full ${
                  workflows.find((w) => w.version === currentVersion)?.isLive
                    ? 'bg-emerald-400 animate-pulse'
                    : 'bg-neutral-500'
                }`}
              />
              <span className="font-semibold">v{currentVersion}</span>
              <span className="text-[10px] uppercase font-bold opacity-80">
                [{workflows.find((w) => w.version === currentVersion)?.isLive ? 'LIVE' : (workflows.length > 0 ? 'DRAFT' : 'NEW')}]
              </span>
              <ChevronDown className="size-3 text-neutral-400" />
            </button>

            {/* Dropdown Menu */}
            {isVersionDropdownOpen && (
              <div
                className="absolute left-0 top-full mt-2 w-72 rounded-xl border border-neutral-800 bg-neutral-950 p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-2.5 py-1.5 text-[10px] font-semibold text-neutral-400 border-b border-neutral-900">
                  <span>PROJECT VERSIONS ({workflows.length})</span>
                  {workflows.find((w) => w.isLive) && (
                    <span className="text-emerald-400 font-mono">
                      Live: v{workflows.find((w) => w.isLive)?.version}
                    </span>
                  )}
                </div>

                <div className="max-h-56 overflow-y-auto py-1 space-y-1">
                  {workflows.length === 0 ? (
                    <div className="p-3 text-center text-neutral-500 text-xs">
                      No versions yet. Click Save or Publish to create v1.0.0.
                    </div>
                  ) : (
                    workflows.map((wf) => {
                      const isSelected = wf.version === currentVersion;
                      const isLive = wf.isLive;

                      return (
                        <div
                          key={wf.version}
                          className={`flex items-center justify-between rounded-lg p-2 text-xs transition-colors ${
                            isSelected
                              ? 'bg-brand-950/40 border border-brand-800/40 text-white'
                              : 'hover:bg-neutral-900 text-neutral-300'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleSelectVersion(wf)}
                            className="flex flex-col text-left flex-1"
                          >
                            <div className="flex items-center gap-1.5 font-mono font-semibold">
                              <span>v{wf.version}</span>
                              <span
                                className={`rounded px-1 text-[8px] uppercase font-bold border ${
                                  isLive
                                    ? 'bg-emerald-950 border-emerald-800/60 text-emerald-400'
                                    : 'bg-neutral-800 border-neutral-700 text-neutral-400'
                                }`}
                              >
                                {isLive ? 'LIVE' : 'DRAFT'}
                              </span>
                            </div>
                            {wf.note && (
                              <span className="text-[10px] text-neutral-400 truncate max-w-[170px] mt-0.5">
                                {wf.note}
                              </span>
                            )}
                          </button>

                          {!isLive && (
                            <button
                              type="button"
                              onClick={() => {
                                handleMakeLive(wf.version);
                                setIsVersionDropdownOpen(false);
                              }}
                              className="inline-flex items-center gap-1 rounded bg-emerald-950/80 border border-emerald-700/60 px-1.5 py-0.5 text-[10px] text-emerald-300 hover:bg-emerald-900 transition-colors"
                              title="Make this version LIVE"
                            >
                              <Rocket className="size-2.5" />
                              Make Live
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="pt-1.5 border-t border-neutral-900 flex justify-between items-center px-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsVersionDropdownOpen(false);
                      setIsPublishModalOpen(true);
                    }}
                    className="w-full text-center rounded-lg bg-brand-600/10 border border-brand-500/30 py-1.5 text-[11px] font-semibold text-brand-400 hover:bg-brand-600/20 transition-colors cursor-pointer"
                  >
                    + Publish as New Version
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick Make Live Button for Current Version (if not live) */}
          {workflows.find((w) => w.version === currentVersion) &&
            !workflows.find((w) => w.version === currentVersion)?.isLive && (
              <button
                type="button"
                onClick={() => handleMakeLive(currentVersion)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-700/60 bg-emerald-950/60 px-2.5 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-900/60 transition-all shadow-xs cursor-pointer"
                title="Promote this loaded version to LIVE"
              >
                <Rocket className="size-3 text-emerald-400" />
                <span>Make Live</span>
              </button>
            )}

          {/* Actionable Validation Status Badge */}
          <button
            type="button"
            onClick={() => setIsValidationOpen((v) => !v)}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-mono border transition-all cursor-pointer ${
              validation.isValid
                ? 'border-emerald-800/40 bg-emerald-950/40 text-emerald-400 hover:bg-emerald-950/70'
                : 'border-amber-800/50 bg-amber-950/50 text-amber-300 hover:bg-amber-950/80 animate-pulse'
            }`}
            title="Click to view graph validation details"
          >
            <span
              className={`size-1.5 rounded-full ${
                validation.isValid ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            <span>
              {validation.isValid
                ? 'Graph Valid'
                : `${validation.summary.errors} errors, ${validation.summary.warnings} warnings`}
            </span>
          </button>
        </div>

        {/* Center Quick-Add & Undo/Redo Controls */}
        <div className="hidden lg:flex items-center gap-1 rounded-xl border border-neutral-800 bg-neutral-900/80 p-1">
          <button
            type="button"
            onClick={handleUndo}
            disabled={history.length === 0}
            className="flex size-7 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-800 hover:text-white disabled:opacity-30 transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={future.length === 0}
            className="flex size-7 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-800 hover:text-white disabled:opacity-30 transition-colors"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="size-3.5" />
          </button>
          <div className="h-4 w-px bg-neutral-800 mx-1" />
          <button
            type="button"
            onClick={() => handleAddNode('llm')}
            className="rounded-lg px-2 py-1 text-xs font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
          >
            + LLM
          </button>
          <button
            type="button"
            onClick={() => handleAddNode('agent')}
            className="rounded-lg px-2 py-1 text-xs font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
          >
            + Agent
          </button>
          <button
            type="button"
            onClick={() => handleAddNode('condition')}
            className="rounded-lg px-2 py-1 text-xs font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
          >
            + Condition
          </button>
          <button
            type="button"
            onClick={() => handleAddNode('http_request')}
            className="rounded-lg px-2 py-1 text-xs font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
          >
            + HTTP Tool
          </button>
          <button
            type="button"
            onClick={() => handleAddNode('structured_output')}
            className="rounded-lg px-2 py-1 text-xs font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
          >
            + Structured Out
          </button>
        </div>

        {/* Right Primary Action Controls */}
        <div className="flex items-center gap-2">
          {/* JSON Spec Modal Button */}
          <button
            type="button"
            onClick={() => setIsJsonModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:border-neutral-700 hover:text-white transition-colors"
          >
            <Code2 className="size-3.5 text-brand-400" />
            Canonical JSON
          </button>

          {/* AI Copilot Toggle */}
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

          {/* Test Workflow Button */}
          <button
            type="button"
            onClick={() => setIsTestPanelOpen((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              isTestPanelOpen
                ? 'bg-sky-600 text-white shadow-sky-500/20 shadow-md'
                : 'border border-neutral-800 bg-neutral-900 text-neutral-300 hover:bg-neutral-800'
            }`}
          >
            <Play className="size-3.5 fill-current" />
            Test Flow
          </button>

          {/* Unified Save & Version Split Control (Pattern B) */}
          <div className="relative inline-flex items-center rounded-lg shadow-sm">
            {/* Primary Action Button */}
            <button
              type="button"
              onClick={() => {
                if (workflows.length === 0 || currentWf?.isLive) {
                  setIsPublishModalOpen(true);
                } else {
                  handleSaveWorkflow();
                }
              }}
              disabled={saveStatus === 'saving'}
              className="inline-flex items-center gap-1.5 rounded-l-lg bg-white px-3.5 py-1.5 text-xs font-semibold text-neutral-950 transition-all hover:bg-neutral-200 disabled:opacity-50 cursor-pointer"
              title={
                !validation.isValid
                  ? `Cannot save: ${validation.summary.errors} validation error(s). Click to review issues.`
                  : workflows.length === 0
                  ? 'Configure and save initial version tag & note'
                  : currentWf?.isLive
                  ? 'LIVE version is immutable. Click to publish as new release'
                  : 'Save draft changes (Ctrl+S)'
              }
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
              ) : workflows.length === 0 ? (
                <>
                  <Save className="size-3.5 text-brand-600" />
                  Save Initial Version…
                  {!validation.isValid && (
                    <span className="size-1.5 rounded-full bg-red-500 animate-pulse" title={`${validation.summary.errors} errors`} />
                  )}
                </>
              ) : currentWf?.isLive ? (
                <>
                  <Rocket className="size-3.5 text-brand-600" />
                  Publish New Version…
                </>
              ) : (
                <>
                  <Save className="size-3.5" />
                  Save Draft
                  {!validation.isValid && (
                    <span className="size-1.5 rounded-full bg-red-500 animate-pulse" title={`${validation.summary.errors} errors`} />
                  )}
                </>
              )}
            </button>

            {/* Split Dropdown Trigger */}
            <button
              type="button"
              onClick={() => setIsSaveMenuOpen((v) => !v)}
              className="inline-flex items-center justify-center rounded-r-lg border-l border-neutral-300 bg-white px-2 py-1.5 text-neutral-900 transition-all hover:bg-neutral-200 cursor-pointer"
              title="More versioning actions"
            >
              <ChevronDown className="size-3.5" />
            </button>

            {/* Dropdown Menu */}
            {isSaveMenuOpen && (
              <div
                className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-neutral-800 bg-neutral-950 p-1.5 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100 text-xs"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-2.5 py-1.5 text-[10px] font-semibold text-neutral-400 border-b border-neutral-900">
                  VERSION ACTIONS
                </div>

                <div className="py-1 space-y-0.5">
                  <button
                    type="button"
                    disabled={currentWf?.isLive || workflows.length === 0}
                    onClick={() => {
                      setIsSaveMenuOpen(false);
                      handleSaveWorkflow();
                    }}
                    className="w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-left text-neutral-200 hover:bg-neutral-900 disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Save className="size-3.5 text-neutral-400" />
                      <span>Save Draft</span>
                    </div>
                    <span className="text-[10px] text-neutral-500 font-mono">Ctrl+S</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsSaveMenuOpen(false);
                      setIsPublishModalOpen(true);
                    }}
                    className="w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-left text-neutral-200 hover:bg-neutral-900 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Rocket className="size-3.5 text-brand-400" />
                      <span>
                        {workflows.length === 0
                          ? 'Configure Initial Version…'
                          : 'Save as New Version…'}
                      </span>
                    </div>
                  </button>

                  {currentWf && !currentWf.isLive && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsSaveMenuOpen(false);
                        handleMakeLive(currentVersion);
                      }}
                      className="w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-left text-emerald-300 hover:bg-emerald-950/40 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Rocket className="size-3.5 text-emerald-400" />
                        <span>Make v{currentVersion} LIVE</span>
                      </div>
                    </button>
                  )}
                </div>

                <div className="pt-1 border-t border-neutral-900">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSaveMenuOpen(false);
                      setIsPublishModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] text-neutral-400 hover:bg-neutral-900 hover:text-white transition-colors cursor-pointer"
                  >
                    <span>Version History ({workflows.length})</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Main Workspace Body ────────────────────────────────────────── */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Left Searchable Node Palette */}
        <NodeLibrary
          isOpen={isLibraryOpen}
          onToggle={() => setIsLibraryOpen((v) => !v)}
          onAddNode={(type) => handleAddNode(type)}
        />

        {/* ── Main Virtual Canvas ──────────────────────────────────────── */}
        <div
          ref={canvasRef}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onWheel={handleCanvasWheel}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleCanvasDrop}
          onClick={() => {
            if (connectingFrom) {
              setConnectingFrom(null);
            } else {
              setSelectedNodeId(null);
              setSelectedEdgeId(null);
            }
          }}
          className="relative flex-1 select-none overflow-hidden bg-[#0a0d12] cursor-grab active:cursor-grabbing"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(255,255,255,0.08) 1.2px, transparent 1.2px)',
            backgroundPosition: `${pan.x}px ${pan.y}px`,
            backgroundSize: `${26 * zoom}px ${26 * zoom}px`,
          }}
        >
          {/* Active Connection Notice Banner */}
          {connectingFrom && (
            <div className="absolute top-4 left-1/2 z-30 -translate-x-1/2 rounded-full border border-sky-500/50 bg-sky-950/90 px-4 py-1.5 text-xs font-medium text-sky-200 shadow-xl backdrop-blur-md flex items-center gap-2">
              <span className="size-2 rounded-full bg-sky-400 animate-ping" />
              <span>
                Connecting from{' '}
                <strong className="text-white underline">{connectingFrom.nodeId}</strong>
                {connectingFrom.handleLabel && ` (${connectingFrom.handleLabel})`}
              </span>
              <span className="text-neutral-400">· Click any target node to connect (Esc to cancel)</span>
            </div>
          )}

          {/* Scaled Virtual Canvas Container */}
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
            {/* SVG Bezier Edges */}
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
                  Boolean(edge.label) || srcNode.type === 'condition' || Boolean(edge.sourceHandle);

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
                    {/* Transparent Hit Target */}
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

                    {/* Visible Line */}
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

                    {/* Branch Label */}
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

            {/* Interactive Node Cards */}
            {graph.nodes.map((node) => {
              const isSelected = selectedNodeId === node.id;
              const isConnecting = connectingFrom?.nodeId === node.id;
              const isTestingActive = highlightedNodeId === node.id;
              const def = NODE_REGISTRY[node.type] || NODE_REGISTRY.agent;

              return (
                <div
                  key={node.id}
                  onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (connectingFrom && connectingFrom.nodeId !== node.id) {
                      handleConnectNodes(node.id);
                    } else {
                      setSelectedNodeId(node.id);
                      setSelectedEdgeId(null);
                      setIsInspectorOpen(true);
                    }
                  }}
                  style={{
                    transform: `translate(${node.position.x}px, ${node.position.y}px)`,
                    width: `${NODE_WIDTH}px`,
                  }}
                  className={`group pointer-events-auto absolute rounded-xl border p-3 shadow-xl transition-all cursor-move select-none ${
                    isTestingActive
                      ? 'border-brand-400 bg-brand-950/40 ring-4 ring-brand-400/60 shadow-brand-500/20'
                      : isSelected
                      ? 'border-brand-400 bg-neutral-900 ring-2 ring-brand-400/40 shadow-brand-500/10'
                      : isConnecting
                      ? 'border-sky-400 bg-neutral-900 ring-2 ring-sky-400/30'
                      : 'border-neutral-800 bg-neutral-950/95 hover:border-neutral-700'
                  }`}
                >
                  {/* Top Target Handle */}
                  {def.hasInputHandle && (
                    <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 size-3 rounded-full border border-neutral-700 bg-neutral-900 flex items-center justify-center">
                      <div
                        className={`size-1.5 rounded-full ${
                          connectingFrom && connectingFrom.nodeId !== node.id
                            ? 'bg-sky-400 animate-ping'
                            : 'bg-neutral-500'
                        }`}
                      />
                    </div>
                  )}

                  {/* Header Row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {def.icon}
                      <span
                        className={`rounded px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider ${def.badgeClass}`}
                      >
                        {node.data?.sublabel || def.sublabel}
                      </span>
                    </div>

                    {/* Quick Hover Controls */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        title="Duplicate (Ctrl+D)"
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
                        title="Delete (Del)"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteNode(node.id);
                        }}
                        className="size-5 rounded flex items-center justify-center text-neutral-400 hover:bg-red-950/50 hover:text-red-400"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </div>

                  {/* Title */}
                  <div className="mt-1.5 text-xs font-semibold text-white truncate">
                    {node.title}
                  </div>

                  {/* Config Preview Summary */}
                  <div className="mt-0.5 text-[10px] font-mono text-neutral-400 truncate">
                    {node.type === 'start' &&
                      `${node.data?.config?.inputFields?.length || 0} input fields`}
                    {node.type === 'llm' &&
                      `${node.data?.config?.model || 'gpt-4o-mini'} · ${
                        node.data?.config?.responseFormat || 'text'
                      }`}
                    {node.type === 'agent' &&
                      `${node.data?.config?.model || 'gpt-4o'} (${
                        node.data?.config?.availableTools?.length || 0
                      } tools)`}
                    {node.type === 'condition' &&
                      `${node.data?.config?.routes?.length || 0} routes · ${
                        node.data?.config?.conditions?.length || 0
                      } rules`}
                    {node.type === 'http_request' &&
                      `${node.data?.config?.method || 'POST'} ${node.data?.config?.url || ''}`}
                    {node.type === 'transform' &&
                      `${node.data?.config?.assignments?.length || 0} state mappings`}
                    {node.type === 'structured_output' && 'JSON Schema validation'}
                    {node.type === 'end' &&
                      `Delivery: ${node.data?.config?.responseFormat || 'json'}`}
                  </div>

                  {/* Bottom Source Handle */}
                  {def.hasOutputHandle && node.type !== 'condition' && (
                    <button
                      type="button"
                      title="Connect to next step"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConnectingFrom({ nodeId: node.id });
                      }}
                      className="absolute -bottom-2 left-1/2 -translate-x-1/2 size-4 rounded-full border border-neutral-700 bg-neutral-900 hover:border-brand-400 hover:bg-brand-600 text-neutral-400 hover:text-white flex items-center justify-center transition-colors shadow-xs"
                    >
                      <Plus className="size-2.5" />
                    </button>
                  )}

                  {/* Condition Node Branch Output Handles */}
                  {node.type === 'condition' && (
                    <div className="absolute -bottom-3 left-0 right-0 flex justify-center gap-1.5 px-2">
                      {(node.data?.config?.routes || [
                        { id: 'route_1', label: 'Route 1' },
                        { id: 'route_2', label: 'Route 2' },
                      ]).map((route: any) => (
                        <button
                          key={route.id}
                          type="button"
                          title={`Connect branch "${route.label}"`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setConnectingFrom({
                              nodeId: node.id,
                              handleId: route.id,
                              handleLabel: route.label,
                            });
                          }}
                          className="rounded-full border border-neutral-700 bg-neutral-900 hover:border-sky-400 hover:bg-sky-600 text-[8px] font-mono px-1.5 py-0.5 text-neutral-300 hover:text-white shadow-xs transition-colors"
                        >
                          {route.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Floating Canvas Zoom & Viewport Controls (Bottom-Left) */}
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
                setPan({ x: 120, y: 40 });
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
          </div>

          {/* Canvas Minimap (Bottom-Right) */}
          <CanvasMinimap
            graph={graph}
            pan={pan}
            zoom={zoom}
            viewportSize={viewportSize}
          />

          {/* Actionable Validation Drawer */}
          <ValidationPanel
            validation={validation}
            isOpen={isValidationOpen}
            onClose={() => setIsValidationOpen(false)}
            onSelectIssue={(issue: ValidationIssue) => {
              if (issue.nodeId) {
                setSelectedNodeId(issue.nodeId);
                const targetNode = graph.nodes.find((n) => n.id === issue.nodeId);
                if (targetNode && canvasRef.current) {
                  const rect = canvasRef.current.getBoundingClientRect();
                  setPan({
                    x: Math.round(rect.width / 2 - (targetNode.position.x + NODE_WIDTH / 2) * zoom),
                    y: Math.round(rect.height / 2 - (targetNode.position.y + NODE_HEIGHT / 2) * zoom),
                  });
                }
              } else if (issue.edgeId) {
                setSelectedEdgeId(issue.edgeId);
              }
            }}
          />
        </div>

        {/* ── Contextual Schema-Driven Properties Panel ────────────────── */}
        {selectedNode && isInspectorOpen && !isTestPanelOpen && !isCopilotOpen && (
          <PropertiesPanel
            node={selectedNode}
            graph={graph}
            onUpdateNode={handleUpdateNode}
            onDeleteNode={handleDeleteNode}
            onClose={() => setSelectedNodeId(null)}
          />
        )}

        {/* ── Workflow Test Panel ───────────────────────────────────────── */}
        <TestPanel
          graph={graph}
          isOpen={isTestPanelOpen}
          onClose={() => setIsTestPanelOpen(false)}
          onNodeHighlight={(id) => setHighlightedNodeId(id)}
        />

        {/* ── AI Copilot Drawer ────────────────────────────────────────── */}
        {isCopilotOpen && (
          <aside className="w-96 shrink-0 border-l border-neutral-800 bg-neutral-950 flex flex-col z-20 text-xs">
            <div className="flex h-13 items-center justify-between border-b border-neutral-800 px-4">
              <div className="flex items-center gap-2">
                <div className="flex size-6 items-center justify-center rounded-md bg-brand-500 text-white">
                  <Sparkles className="size-3.5" />
                </div>
                <span className="font-semibold text-white">AI Workflow Architect</span>
              </div>
              <button
                type="button"
                onClick={() => setIsCopilotOpen(false)}
                className="text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Quick Template Chips */}
            <div className="border-b border-neutral-800/80 bg-neutral-900/40 p-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                Architectural Blueprints
              </span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {[
                  'Customer support triage with refund routing',
                  'RAG research agent with live web search',
                  'E-commerce order status and fulfillment',
                ].map((blueprint) => (
                  <button
                    key={blueprint}
                    type="button"
                    onClick={() => {
                      const res = generateWorkflowFromPrompt(blueprint);
                      updateGraphWithHistory(() => deserializeFromCanonical(res.workflow));
                      setTimeout(() => handleFitView(), 50);
                    }}
                    className="rounded-lg border border-neutral-800 bg-neutral-900 px-2 py-1 text-[11px] text-neutral-300 hover:border-brand-500 hover:text-white transition-colors"
                  >
                    {blueprint}
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Thread */}
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {copilotMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-brand-600 text-white'
                        : 'border border-neutral-800 bg-neutral-900 text-neutral-200'
                    }`}
                  >
                    <p>{msg.content}</p>

                    {msg.highlights && (
                      <ul className="mt-2 space-y-1 list-disc list-inside text-[11px] text-neutral-300">
                        {msg.highlights.map((h, i) => (
                          <li key={i}>{h}</li>
                        ))}
                      </ul>
                    )}

                    {msg.suggestedGraph && (
                      <div className="mt-3 pt-2 border-t border-neutral-800">
                        <button
                          type="button"
                          onClick={() => {
                            updateGraphWithHistory(() => msg.suggestedGraph!);
                            setTimeout(() => handleFitView(), 50);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1 font-semibold text-neutral-950 hover:bg-neutral-200 transition-colors shadow-xs"
                        >
                          <Play className="size-3 fill-neutral-950" />
                          Apply Generated Graph to Canvas
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isCopilotGenerating && (
                <div className="flex items-center gap-2 text-neutral-400">
                  <Loader2 className="size-3.5 animate-spin text-brand-400" />
                  Generating workflow architecture...
                </div>
              )}
            </div>

            {/* Input Form */}
            <div className="p-3 border-t border-neutral-800">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendCopilotPrompt();
                }}
                className="relative"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Describe your agent workflow..."
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-900 py-2 pl-3 pr-10 text-xs text-white placeholder-neutral-500 focus:border-brand-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || isCopilotGenerating}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 flex size-7 items-center justify-center rounded-lg bg-brand-600 text-white disabled:opacity-30"
                >
                  <Send className="size-3.5" />
                </button>
              </form>
            </div>
          </aside>
        )}
      </div>

      {/* ── Notification Toast ─────────────────────────────────────────── */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border border-neutral-700 bg-neutral-900/95 px-4 py-3 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-5 duration-200 text-xs">
          <span
            className={`size-2 rounded-full ${
              notification.type === 'success'
                ? 'bg-emerald-400'
                : notification.type === 'error'
                ? 'bg-rose-400'
                : 'bg-brand-400'
            }`}
          />
          <span className="font-medium text-white">{notification.message}</span>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="ml-2 text-neutral-400 hover:text-white"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* ── Publishing Modal ───────────────────────────────────────────── */}
      <PublishModal
        projectId={projectId}
        graph={graph}
        validation={validation}
        workflows={workflows}
        currentVersion={currentVersion}
        isOpen={isPublishModalOpen}
        onClose={() => setIsPublishModalOpen(false)}
        onSelectVersion={handleSelectVersion}
        onMakeLive={handleMakeLive}
        onPublishNewVersion={handlePublishNewVersion}
      />

      {/* ── Canonical JSON Modal ───────────────────────────────────────── */}
      <JsonModal
        graph={graph}
        isOpen={isJsonModalOpen}
        onClose={() => setIsJsonModalOpen(false)}
        onImportGraph={(imported) => {
          updateGraphWithHistory(() => imported);
          setTimeout(() => handleFitView(), 50);
        }}
      />
    </div>
  );
}
