import { useState, useRef, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Send,
  ArrowLeft,
  Rocket,
  AlertCircle,
  Clock,
  RotateCcw,
  Layers,
  ChevronRight,
  Activity,
  Bot,
  User,
  Wrench,
  CheckCircle2,
  X,
  ExternalLink,
} from 'lucide-react';
import { useLiveWorkflow, type ChatMessage } from '../hooks/useLiveWorkflow';

export default function LiveWorkflowChatPage() {
  const { id } = useParams<{ id: string }>();
  const targetId = id || '';

  const {
    liveWorkflow,
    isWorkflowLoading,
    workflowError,
    messages,
    sendMessage,
    isSending,
    resetSession,
  } = useLiveWorkflow(targetId);

  const [inputMessage, setInputMessage] = useState('');
  const [activeTraceMessage, setActiveTraceMessage] = useState<ChatMessage | null>(null);
  const [isGraphDrawerOpen, setIsGraphDrawerOpen] = useState(false);
  const [expandedTraceNodes, setExpandedTraceNodes] = useState<Record<string, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  // Focus input on load
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = inputMessage.trim();
    if (!text || isSending) return;
    setInputMessage('');
    await sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleNodeExpand = (nodeId: string) => {
    setExpandedTraceNodes((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  // Derive initial suggestions from workflow start node or defaults
  const samplePrompts = useMemo(() => {
    const startNode = liveWorkflow?.graph?.nodes?.find((n: any) => n.type === 'start');
    const inputFields = startNode?.data?.config?.inputFields || startNode?.config?.inputFields;
    if (inputFields && inputFields.length > 0) {
      return [
        `Run workflow with ${inputFields[0].name} = "${inputFields[0].defaultValue || 'Hello agent'}"`,
        'Explain how this workflow processes my request.',
        'Execute a complete test run of this agent workflow.',
      ];
    }
    return [
      'How can you help me today?',
      'Explain how this workflow processes my request.',
      'Execute a complete test run of this agent workflow.',
    ];
  }, [liveWorkflow]);

  if (isWorkflowLoading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-neutral-950 text-neutral-200">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 mb-4 animate-pulse">
          <Rocket className="size-6 animate-bounce" />
        </div>
        <h2 className="text-sm font-semibold text-white">Connecting to Live Workflow Agent...</h2>
        <p className="text-xs text-neutral-500 mt-1">Loading active graph configuration and models</p>
      </div>
    );
  }

  if (workflowError || !liveWorkflow) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-neutral-950 p-6 text-neutral-200">
        <div className="max-w-md w-full rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 text-center space-y-4 shadow-2xl">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <AlertCircle className="size-6" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-base font-bold text-white">No Live Version Active</h1>
            <p className="text-xs text-neutral-400 leading-relaxed">
              This project does not currently have a workflow version promoted to <span className="text-emerald-400 font-mono font-semibold">LIVE</span>.
              You must save a version in Studio and click <strong>Make Live</strong> before you can chat with the live agent.
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            <Link
              to={liveWorkflow?.projectId ? `/projects/${liveWorkflow.projectId}` : '/dashboard'}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-500 transition-colors shadow-md"
            >
              <ArrowLeft className="size-4" />
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const projectName = liveWorkflow.project?.name || 'Project Agent';
  const workflowVersion = liveWorkflow.version;
  const studioUrl = liveWorkflow.projectId ? `/projects/${liveWorkflow.projectId}` : '/dashboard';

  return (
    <div className="flex h-screen w-screen flex-col bg-neutral-950 text-neutral-200 overflow-hidden select-text">
      {/* ── Top Header Navigation Bar ──────────────────────────────────── */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-800/80 bg-neutral-900/50 px-4 backdrop-blur-md z-30">
        <div className="flex items-center gap-3">
          <Link
            to={studioUrl}
            className="flex size-8 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            title="Return to Studio Canvas"
          >
            <ArrowLeft className="size-4" />
          </Link>

          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-950 border border-emerald-700/60 text-emerald-400">
              <Bot className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white text-xs leading-none">
                  {projectName}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 bg-emerald-950/80 border border-emerald-700/60 text-[10px] font-mono font-bold text-emerald-300">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  v{workflowVersion} LIVE
                </span>
              </div>
              <p className="text-[10px] text-neutral-400 mt-0.5">
                {liveWorkflow.note || 'Active Live Agentic Workflow'}
              </p>
            </div>
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-2">
          {/* Inspect Graph Architecture */}
          <button
            type="button"
            onClick={() => setIsGraphDrawerOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/80 px-2.5 py-1.5 text-xs text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Inspect executing workflow graph nodes and structure"
          >
            <Layers className="size-3.5 text-brand-400" />
            <span className="hidden sm:inline">Inspect Graph</span>
          </button>

          {/* Start New Chat Session */}
          <button
            type="button"
            onClick={resetSession}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/80 px-2.5 py-1.5 text-xs text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Start fresh conversation"
          >
            <RotateCcw className="size-3.5" />
            <span className="hidden sm:inline">New Chat</span>
          </button>
        </div>
      </header>

      {/* ── Main Customer Chat Canvas ─────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden relative">
        <main className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {/* Welcome / Onboarding Card */}
            <div className="mx-auto max-w-2xl rounded-2xl border border-neutral-800/80 bg-neutral-900/30 p-5 space-y-4">
              <div className="flex items-start gap-3.5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-brand-500/10 border border-emerald-500/30 text-emerald-400 shadow-sm">
                  <Rocket className="size-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-white">
                    Live Workflow Agent Online
                  </h3>
                  <p className="text-xs text-neutral-300 leading-relaxed">
                    You are directly communicating with <span className="font-semibold text-white">{projectName}</span> (version <span className="font-mono text-emerald-400">v{workflowVersion}</span>).
                    Every message triggers the actual live workflow pipeline in real-time, executing conditions, LLM prompts, and autonomous agent tools.
                  </p>
                </div>
              </div>

              {/* Sample Prompts */}
              {messages.length === 0 && (
                <div className="pt-2 border-t border-neutral-800/80 space-y-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                    Suggested prompts to try:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {samplePrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => {
                          setInputMessage(prompt);
                          inputRef.current?.focus();
                        }}
                        className="rounded-xl border border-neutral-800 bg-neutral-900/80 px-3 py-1.5 text-xs text-neutral-300 hover:text-white hover:border-brand-500/50 hover:bg-brand-950/20 transition-all text-left cursor-pointer"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Conversation Messages */}
            <div className="mx-auto max-w-2xl space-y-4">
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 text-xs leading-relaxed animate-in fade-in duration-200 ${
                      isUser ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {!isUser && (
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-950 border border-emerald-700/60 text-emerald-400 shadow-sm mt-0.5">
                        <Bot className="size-4" />
                      </div>
                    )}

                    <div className={`space-y-1 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
                      <div
                        className={`rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-sm ${
                          isUser
                            ? 'bg-brand-600 text-white rounded-br-none'
                            : msg.isError
                            ? 'bg-rose-950/50 border border-rose-800/60 text-rose-200 rounded-bl-none'
                            : 'bg-neutral-900/90 border border-neutral-800 text-neutral-200 rounded-bl-none'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.text}</p>

                        {/* Execution Metas and Trace Pill */}
                        {!isUser && !msg.isError && (
                          <div className="mt-2.5 pt-2 border-t border-neutral-800/80 flex flex-wrap items-center gap-2 text-[10px] font-mono text-neutral-400">
                            {msg.durationMs !== undefined && (
                              <span className="flex items-center gap-1">
                                <Clock className="size-2.5 text-neutral-400" />
                                {Math.round(msg.durationMs)}ms
                              </span>
                            )}

                            {msg.totalTokens !== undefined && msg.totalTokens > 0 && (
                              <span>{msg.totalTokens} tokens</span>
                            )}

                            {msg.stepTraces && msg.stepTraces.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setActiveTraceMessage(msg)}
                                className="inline-flex items-center gap-1 rounded bg-neutral-800 hover:bg-neutral-700 px-1.5 py-0.5 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                              >
                                <Activity className="size-2.5 text-brand-400" />
                                <span>{msg.stepTraces.length} steps executed</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      <span className="text-[10px] text-neutral-500 px-1">
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    {isUser && (
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-neutral-800 text-neutral-300 border border-neutral-700 mt-0.5">
                        <User className="size-4" />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Thinking / Executing Indicator */}
              {isSending && (
                <div className="flex gap-3 text-xs justify-start animate-in fade-in">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-950 border border-emerald-700/60 text-emerald-400 animate-pulse">
                    <Bot className="size-4" />
                  </div>
                  <div className="rounded-2xl rounded-bl-none border border-neutral-800 bg-neutral-900/90 px-4 py-3 space-y-1.5 shadow-sm">
                    <div className="flex items-center gap-2 text-xs text-neutral-300 font-medium">
                      <Activity className="size-3.5 animate-spin text-emerald-400" />
                      <span>Executing live workflow graph...</span>
                    </div>
                    <p className="text-[10px] text-neutral-500">
                      Evaluating agent routes, calling tools, and querying models
                    </p>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* ── Chat Input Footer ────────────────────────────────────────── */}
          <footer className="border-t border-neutral-800/80 bg-neutral-900/40 p-4 backdrop-blur-md">
            <form onSubmit={handleSend} className="mx-auto max-w-2xl">
              <div className="relative rounded-2xl border border-neutral-800 bg-neutral-900/90 p-2 shadow-xl focus-within:border-brand-500/50 transition-colors">
                <textarea
                  ref={inputRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message to run this agent workflow..."
                  disabled={isSending}
                  rows={2}
                  className="w-full resize-none bg-transparent px-2 text-xs text-white placeholder-neutral-500 focus:outline-none disabled:opacity-50"
                />

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-neutral-500 font-mono">
                    Press <kbd className="rounded bg-neutral-800 px-1 py-0.5">Enter</kbd> to run
                  </span>

                  <button
                    type="submit"
                    disabled={!inputMessage.trim() || isSending}
                    className="flex size-8 items-center justify-center rounded-xl bg-brand-600 text-white hover:bg-brand-500 disabled:opacity-40 disabled:hover:bg-brand-600 transition-all cursor-pointer shadow-md"
                  >
                    <Send className="size-3.5" />
                  </button>
                </div>
              </div>
            </form>
          </footer>
        </main>

        {/* ── Side Drawer: Detailed Node Execution Trace ───────────────────── */}
        {activeTraceMessage && (
          <aside className="w-80 sm:w-96 border-l border-neutral-800 bg-neutral-950 flex flex-col z-40 animate-in slide-in-from-right duration-200">
            <div className="flex h-14 items-center justify-between border-b border-neutral-800 px-4">
              <div className="flex items-center gap-2">
                <Activity className="size-4 text-emerald-400" />
                <h3 className="text-xs font-semibold text-white">Execution Trace Inspector</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveTraceMessage(null)}
                className="flex size-7 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3 space-y-1 text-xs">
                <div className="font-semibold text-white flex items-center justify-between">
                  <span>Run Execution</span>
                  <span className="font-mono text-emerald-400 text-[10px]">
                    {Math.round(activeTraceMessage.durationMs || 0)}ms
                  </span>
                </div>
                <div className="text-[10px] font-mono text-neutral-400 truncate">
                  ID: {activeTraceMessage.executionId}
                </div>
                <div className="text-[10px] font-mono text-neutral-400">
                  Version: v{workflowVersion}
                </div>
              </div>

              {activeTraceMessage.stepTraces?.map((step, idx) => {
                const isExpanded = expandedTraceNodes[step.node_id];
                return (
                  <div
                    key={step.node_id || idx}
                    className="rounded-xl border border-neutral-800/80 bg-neutral-900/40 p-3 space-y-2 text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => toggleNodeExpand(step.node_id)}
                      className="w-full flex items-center justify-between text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
                        <span className="font-medium text-white truncate">
                          {idx + 1}. {step.node_name}
                        </span>
                        <span className="rounded bg-neutral-800 px-1 py-0.2 text-[9px] font-mono text-neutral-400 uppercase">
                          {step.node_type}
                        </span>
                      </div>
                      <ChevronRight
                        className={`size-3.5 text-neutral-400 transition-transform ${
                          isExpanded ? 'rotate-90' : ''
                        }`}
                      />
                    </button>

                    {isExpanded && (
                      <div className="pt-2 border-t border-neutral-800/60 space-y-2 text-[11px] animate-in fade-in">
                        {step.selected_route && (
                          <div className="flex items-center gap-1.5 text-brand-300 font-mono">
                            <span>Selected Route:</span>
                            <span className="rounded bg-brand-950 px-1 border border-brand-800/40 font-bold">
                              {step.selected_route}
                            </span>
                          </div>
                        )}

                        {step.tool_calls && step.tool_calls.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-semibold text-neutral-400 uppercase">
                              Tools Executed ({step.tool_calls.length}):
                            </span>
                            {step.tool_calls.map((tc) => (
                              <div
                                key={tc.id}
                                className="rounded-lg bg-black/50 p-2 border border-neutral-900 font-mono text-[10px] space-y-1"
                              >
                                <div className="flex items-center justify-between text-emerald-300 font-semibold">
                                  <span className="flex items-center gap-1">
                                    <Wrench className="size-2.5" />
                                    {tc.tool_name}
                                  </span>
                                  <span>{Math.round(tc.duration_ms)}ms</span>
                                </div>
                                <div className="text-neutral-400 truncate">
                                  Args: {JSON.stringify(tc.arguments)}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <div>
                          <span className="text-[10px] font-semibold text-neutral-400 uppercase">Output:</span>
                          <pre className="mt-1 max-h-32 overflow-x-auto rounded-lg bg-black/60 p-2 font-mono text-[10px] text-neutral-300">
                            {JSON.stringify(step.output_data, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </aside>
        )}

        {/* ── Side Drawer: Graph Overview ─────────────────────────────────── */}
        {isGraphDrawerOpen && (
          <aside className="w-80 sm:w-96 border-l border-neutral-800 bg-neutral-950 flex flex-col z-40 animate-in slide-in-from-right duration-200">
            <div className="flex h-14 items-center justify-between border-b border-neutral-800 px-4">
              <div className="flex items-center gap-2">
                <Layers className="size-4 text-brand-400" />
                <h3 className="text-xs font-semibold text-white">Workflow Architecture</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsGraphDrawerOpen(false)}
                className="flex size-7 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3 space-y-1.5 text-xs">
                <span className="text-neutral-400 text-[10px] font-semibold uppercase">Graph Info</span>
                <div className="font-semibold text-white">{liveWorkflow.project?.name || 'Project'} (v{liveWorkflow.version})</div>
                <div className="text-[11px] text-neutral-400">{liveWorkflow.note || 'No release notes.'}</div>
                <div className="text-[10px] font-mono text-neutral-500">
                  Total Nodes: {liveWorkflow.graph?.nodes?.length || 0} • Edges: {liveWorkflow.graph?.edges?.length || 0}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                  Executing Pipeline Nodes
                </span>
                {liveWorkflow.graph?.nodes?.map((node: any, idx: number) => (
                  <div
                    key={node.id || idx}
                    className="flex items-center justify-between rounded-xl border border-neutral-800/80 bg-neutral-900/40 p-2.5 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-neutral-500 text-[10px]">{idx + 1}.</span>
                      <span className="font-medium text-white">{node.name || node.title || node.data?.label || node.id}</span>
                    </div>
                    <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[9px] font-mono text-neutral-400 uppercase">
                      {node.type}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-neutral-800">
                <Link
                  to={studioUrl}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
                >
                  <ExternalLink className="size-3.5" />
                  Edit Graph in Studio
                </Link>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
