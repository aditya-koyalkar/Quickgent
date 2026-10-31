import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  MessageSquare,
  Search,
  Clock,
  Bot,
  User,
  Copy,
  Check,
  Activity,
  ChevronRight,
} from 'lucide-react';
import {
  conversationsApi,
  workflowsApi,
  type ConversationItem,
  type MessageItem,
} from '../../lib/api';

interface ProjectSessionsModalProps {
  projectId: string;
  projectName: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ProjectSessionsModal({
  projectId,
  projectName,
  isOpen,
  onClose,
}: ProjectSessionsModalProps) {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState(false);
  const [expandedTraceNodes, setExpandedTraceNodes] = useState<Record<string, boolean>>({});

  // 1. Fetch all conversations / sessions for this project
  const { data: sessions = [], isLoading: isSessionsLoading } = useQuery<ConversationItem[]>({
    queryKey: ['project-sessions', projectId],
    queryFn: () => workflowsApi.listLiveConversations(projectId),
    enabled: isOpen && Boolean(projectId),
    staleTime: 5000,
  });

  // Auto-select first session if none is selected
  const effectiveSessionId = activeSessionId || (sessions.length > 0 ? sessions[0].id : null);

  // 2. Fetch full message history for the selected session
  const {
    data: activeConversation,
    isLoading: isLoadingMessages,
  } = useQuery({
    queryKey: ['conversation-detail', projectId, effectiveSessionId],
    queryFn: () =>
      effectiveSessionId ? conversationsApi.get(projectId, effectiveSessionId) : null,
    enabled: isOpen && Boolean(effectiveSessionId),
  });

  // Filter sessions by search term
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.workflowVersion && s.workflowVersion.toLowerCase().includes(q)) ||
        s.id.toLowerCase().includes(q),
    );
  }, [sessions, searchQuery]);

  const activeSessionMeta = sessions.find((s) => s.id === effectiveSessionId);
  const sessionWorkflowVersion =
    activeConversation?.workflowVersion ||
    activeConversation?.workflow?.version ||
    activeSessionMeta?.workflowVersion ||
    activeSessionMeta?.workflow?.version ||
    '1.0.0';

  const handleCopyId = (idToCopy: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(idToCopy);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const toggleNodeExpand = (nodeId: string) => {
    setExpandedTraceNodes((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 sm:p-6 animate-in fade-in duration-150">
      <div className="flex h-[90vh] w-full max-w-6xl flex-col rounded-2xl border border-neutral-200 bg-white shadow-2xl overflow-hidden text-neutral-900">
        {/* ── Modal Header ─────────────────────────────────────────────── */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-200 px-6 bg-neutral-50/80">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <MessageSquare className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-neutral-900 leading-none">
                  {projectName}
                </h2>
                <span className="rounded bg-neutral-200/80 px-2 py-0.5 text-[11px] font-semibold text-neutral-700">
                  Customer & Agent Sessions
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Inspect customer conversations, message transcripts, and the specific workflow version executed per session.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700 transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* ── Modal Main Body (Two Columns) ─────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Column: Sessions List */}
          <div className="w-80 shrink-0 border-r border-neutral-200 bg-neutral-50/40 flex flex-col">
            {/* Search Input */}
            <div className="p-3 border-b border-neutral-200 bg-white">
              <div className="relative">
                <Search className="size-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter sessions or version..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-neutral-200 bg-neutral-50 pl-8 pr-2.5 py-1.5 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-400 transition-colors"
                />
              </div>
            </div>

            {/* Sessions Scrollable Feed */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {isSessionsLoading ? (
                <div className="py-12 text-center text-xs text-neutral-400">
                  Loading sessions...
                </div>
              ) : filteredSessions.length === 0 ? (
                <div className="py-12 text-center px-4 space-y-1 text-neutral-400">
                  <MessageSquare className="size-6 mx-auto opacity-40 text-neutral-400" />
                  <p className="text-xs font-medium">No sessions found</p>
                  <p className="text-[11px] text-neutral-500">
                    Interact with the Live workflow or Copilot to record customer sessions.
                  </p>
                </div>
              ) : (
                filteredSessions.map((s) => {
                  const isSelected = s.id === effectiveSessionId;
                  const version = s.workflowVersion || s.workflow?.version || '1.0.0';
                  const msgCount = s._count?.messages || 0;
                  const lastMsg = s.messages?.[0];
                  const lastText =
                    typeof lastMsg?.content === 'object' && lastMsg?.content !== null
                      ? (lastMsg.content as any).text || (lastMsg.content as any).message || ''
                      : String(lastMsg?.content || '');

                  return (
                    <div
                      key={s.id}
                      onClick={() => setActiveSessionId(s.id)}
                      className={`group rounded-xl p-3 text-left transition-all cursor-pointer border ${
                        isSelected
                          ? 'border-emerald-500 bg-white shadow-sm ring-1 ring-emerald-500/20'
                          : 'border-transparent hover:border-neutral-200 hover:bg-white text-neutral-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <span className="font-semibold text-xs truncate flex-1 text-neutral-900">
                          {s.name || 'Untitled Session'}
                        </span>
                        {/* Workflow Version Badge for Session */}
                        <span className="inline-flex items-center shrink-0 rounded px-1.5 py-0.5 bg-emerald-50 border border-emerald-200 text-[10px] font-mono font-bold text-emerald-700">
                          v{version}
                        </span>
                      </div>

                      {lastText && (
                        <p className="text-[11px] text-neutral-500 truncate mt-1">
                          {lastText}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-[10px] text-neutral-400 mt-2 font-mono">
                        <span className="flex items-center gap-1">
                          <Clock className="size-2.5" />
                          {new Date(s.updatedAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span className="bg-neutral-100 rounded px-1 text-neutral-600 font-medium">
                          {msgCount} msgs
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Selected Session Transcript */}
          <div className="flex-1 flex flex-col bg-neutral-50/20 overflow-hidden">
            {effectiveSessionId ? (
              <>
                {/* Active Session Info Header */}
                <div className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-200 px-6 bg-white">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
                    <div className="truncate">
                      <span className="font-bold text-sm text-neutral-900 truncate">
                        {activeConversation?.name || activeSessionMeta?.name || 'Session Transcript'}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                        {/* Workflow Version Tag */}
                        <span className="inline-flex items-center rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 text-[10px] font-mono font-bold text-emerald-700">
                          Workflow v{sessionWorkflowVersion}
                        </span>
                        {activeSessionMeta?.isLive && (
                          <span className="rounded bg-emerald-100 text-emerald-800 text-[10px] font-semibold px-1.5 py-0.2">
                            LIVE Agent
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Session ID Pill with Click-to-Copy */}
                    <div className="flex items-center gap-1.5 rounded-lg bg-neutral-100 border border-neutral-200 px-2.5 py-1 text-xs font-mono text-neutral-600">
                      <span>ID:</span>
                      <span className="font-bold text-neutral-900">{effectiveSessionId.slice(0, 8)}…</span>
                      <button
                        type="button"
                        onClick={() => handleCopyId(effectiveSessionId)}
                        className="hover:text-black p-0.5 transition-colors cursor-pointer"
                        title="Copy full Session ID"
                      >
                        {copiedId ? (
                          <Check className="size-3 text-emerald-600" />
                        ) : (
                          <Copy className="size-3 text-neutral-400" />
                        )}
                      </button>
                    </div>

                    <span className="text-xs text-neutral-400 font-mono hidden sm:inline">
                      {activeConversation?.messages?.length || 0} messages
                    </span>
                  </div>
                </div>

                {/* Messages Transcript Scroll Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {isLoadingMessages ? (
                    <div className="py-16 text-center text-xs text-neutral-400 space-y-2">
                      <div className="size-6 animate-spin rounded-full border-2 border-neutral-300 border-t-emerald-600 mx-auto" />
                      <p>Loading session transcript & traces...</p>
                    </div>
                  ) : activeConversation?.messages?.length === 0 ? (
                    <div className="py-16 text-center text-xs text-neutral-400">
                      No messages recorded in this session.
                    </div>
                  ) : (
                    activeConversation?.messages?.map((msg: MessageItem) => {
                      const isUser = msg.role === 'USER';
                      const contentObj = msg.content as any;
                      const text =
                        typeof contentObj === 'string'
                          ? contentObj
                          : contentObj?.text || contentObj?.reply || JSON.stringify(contentObj);
                      const meta = (msg.metadata || {}) as any;

                      return (
                        <div
                          key={msg.id}
                          className={`flex gap-3 text-xs leading-relaxed ${
                            isUser ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          {!isUser && (
                            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 mt-0.5">
                              <Bot className="size-4" />
                            </div>
                          )}

                          <div className={`space-y-1 max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
                            <div
                              className={`rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-xs ${
                                isUser
                                  ? 'bg-neutral-900 text-white rounded-br-none'
                                  : 'bg-white border border-neutral-200 text-neutral-900 rounded-bl-none'
                              }`}
                            >
                              <p className="whitespace-pre-wrap">{text}</p>

                              {/* Execution Metadata Pills for Assistant */}
                              {!isUser && (meta.durationMs !== undefined || meta.stepTraces?.length > 0) && (
                                <div className="mt-2.5 pt-2 border-t border-neutral-100 flex flex-wrap items-center gap-2 text-[10px] font-mono text-neutral-500">
                                  {meta.durationMs !== undefined && (
                                    <span className="flex items-center gap-1">
                                      <Clock className="size-2.5 text-neutral-400" />
                                      {Math.round(meta.durationMs)}ms
                                    </span>
                                  )}

                                  {msg.model && <span>{msg.model}</span>}

                                  {meta.stepTraces && meta.stepTraces.length > 0 && (
                                    <div className="w-full mt-1.5 space-y-1">
                                      <span className="text-[10px] font-semibold text-neutral-600 uppercase">
                                        Step Execution Traces ({meta.stepTraces.length}):
                                      </span>
                                      {meta.stepTraces.map((st: any, sIdx: number) => {
                                        const isNodeExp = expandedTraceNodes[st.node_id || sIdx];
                                        return (
                                          <div
                                            key={st.node_id || sIdx}
                                            className="rounded-lg bg-neutral-50 p-2 border border-neutral-200 font-mono text-[10px] space-y-1"
                                          >
                                            <button
                                              type="button"
                                              onClick={() => toggleNodeExpand(st.node_id || String(sIdx))}
                                              className="w-full flex items-center justify-between text-left cursor-pointer"
                                            >
                                              <span className="font-semibold text-neutral-800 flex items-center gap-1">
                                                <Activity className="size-2.5 text-emerald-600" />
                                                {sIdx + 1}. {st.node_name} ({st.node_type})
                                              </span>
                                              <ChevronRight
                                                className={`size-3 text-neutral-400 transition-transform ${
                                                  isNodeExp ? 'rotate-90' : ''
                                                }`}
                                              />
                                            </button>

                                            {isNodeExp && (
                                              <div className="pt-1.5 border-t border-neutral-200 text-neutral-600 space-y-1">
                                                {st.selected_route && (
                                                  <div>Route: {st.selected_route}</div>
                                                )}
                                                {st.output_data && (
                                                  <pre className="max-h-24 overflow-x-auto bg-white p-1 rounded border border-neutral-200">
                                                    {JSON.stringify(st.output_data, null, 2)}
                                                  </pre>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            <span className="text-[10px] text-neutral-400 px-1">
                              {new Date(msg.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>

                          {isUser && (
                            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-neutral-200 text-neutral-700 mt-0.5">
                              <User className="size-4" />
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-neutral-400">
                <MessageSquare className="size-8 opacity-40 mb-2" />
                <p className="text-sm font-medium">Select a session from the left</p>
                <p className="text-xs text-neutral-500 mt-1">
                  Click any session in the list to inspect its full conversation history and executed workflow version.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
