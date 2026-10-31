import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  workflowsApi,
  type WorkflowItem,
  type LiveWorkflowChatResult,
  type NodeExecutionTraceItem,
  type ConversationItem,
} from '../lib/api';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  executionId?: string;
  stepTraces?: NodeExecutionTraceItem[];
  durationMs?: number;
  totalTokens?: number;
  isError?: boolean;
}

export function useLiveWorkflow(idOrProjectId: string, initialSessionId?: string | null) {
  const queryClient = useQueryClient();

  // Frontend-generated session ID (UUID v4) for multi-turn persistence
  const [sessionId, setSessionId] = useState<string>(() => {
    return initialSessionId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `sess_${Date.now()}`);
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<NodeExecutionTraceItem[] | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(false);

  // 1. Fetch the live workflow configuration by dynamic workflow ID or project ID
  const {
    data: liveWorkflow,
    isLoading: isWorkflowLoading,
    error: workflowError,
    refetch: refetchWorkflow,
  } = useQuery<WorkflowItem>({
    queryKey: ['live-workflow', idOrProjectId],
    queryFn: () => workflowsApi.getLiveById(idOrProjectId),
    enabled: Boolean(idOrProjectId),
    retry: 1,
  });

  const resolvedProjectId = liveWorkflow?.projectId || idOrProjectId;

  // 2. Fetch all sessions for this project (including workflow version & messages count)
  const {
    data: sessions = [],
    isLoading: isSessionsLoading,
    refetch: refetchSessions,
  } = useQuery<ConversationItem[]>({
    queryKey: ['live-sessions', resolvedProjectId],
    queryFn: () => workflowsApi.listLiveConversations(resolvedProjectId),
    enabled: Boolean(resolvedProjectId),
    staleTime: 5000,
  });

  // 3. Load full message history of an existing session
  const selectSession = useCallback(
    async (targetSessionId: string) => {
      if (!targetSessionId || !resolvedProjectId) return;
      setSessionId(targetSessionId);
      setIsLoadingSession(true);
      try {
        const conv = await workflowsApi.getLiveConversation(resolvedProjectId, targetSessionId);
        if (conv && conv.messages) {
          const loadedMsgs: ChatMessage[] = conv.messages.map((m: any) => {
            const content = m.content as any;
            const text =
              typeof content === 'string'
                ? content
                : content?.text || content?.reply || JSON.stringify(content);
            const meta = (m.metadata || {}) as any;
            return {
              id: m.id,
              role: (m.role || '').toLowerCase() === 'user' ? 'user' : 'assistant',
              text,
              timestamp: m.createdAt,
              executionId: meta?.executionId,
              stepTraces: meta?.stepTraces,
              durationMs: meta?.durationMs,
              totalTokens: m.inputTokens || meta?.totalTokens,
            };
          });
          setMessages(loadedMsgs);
          const lastWithTrace = [...loadedMsgs].reverse().find((m) => m.stepTraces?.length);
          setSelectedTrace(lastWithTrace?.stepTraces || null);
        }
      } catch (err) {
        console.error('Failed to load session history:', err);
      } finally {
        setIsLoadingSession(false);
      }
    },
    [resolvedProjectId],
  );

  // If initialSessionId changes or is provided, load its history
  useEffect(() => {
    if (initialSessionId) {
      selectSession(initialSessionId);
    }
  }, [initialSessionId, selectSession]);

  // 4. Live Chat mutation with dynamic workflow ID or project ID
  const chatMutation = useMutation<
    LiveWorkflowChatResult,
    Error,
    { message: string }
  >({
    mutationFn: ({ message }) =>
      workflowsApi.chatLiveById(idOrProjectId, {
        message,
        sessionId,
        conversationId: sessionId,
      }),
    onMutate: async ({ message }) => {
      // Optimistic user message
      const tempId = `msg_usr_${Date.now()}`;
      const userMsg: ChatMessage = {
        id: tempId,
        role: 'user',
        text: message,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      return { tempId };
    },
    onSuccess: (data) => {
      const assistantMsg: ChatMessage = {
        id: data.assistantMessage?.id || `msg_ast_${Date.now()}`,
        role: 'assistant',
        text: data.reply,
        timestamp: new Date().toISOString(),
        executionId: data.executionId,
        stepTraces: data.stepTraces,
        durationMs: data.totalDurationMs,
        totalTokens: data.totalTokens,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      if (data.stepTraces?.length) {
        setSelectedTrace(data.stepTraces);
      }

      // Invalidate and refresh sessions list
      queryClient.invalidateQueries({ queryKey: ['live-sessions', resolvedProjectId] });
      refetchSessions();
    },
    onError: (err) => {
      const errorMsg: ChatMessage = {
        id: `msg_err_${Date.now()}`,
        role: 'assistant',
        text: `Error executing workflow: ${err.message || 'Workflow run failed'}`,
        timestamp: new Date().toISOString(),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    },
  });

  const sendMessage = useCallback(
    async (messageText: string) => {
      const text = messageText.trim();
      if (!text || chatMutation.isPending) return;
      await chatMutation.mutateAsync({ message: text });
    },
    [chatMutation],
  );

  const resetSession = useCallback(() => {
    const freshId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `sess_${Date.now()}`;
    setSessionId(freshId);
    setMessages([]);
    setSelectedTrace(null);
    return freshId;
  }, []);

  const activeSession = sessions.find((s) => s.id === sessionId);

  return {
    liveWorkflow,
    isWorkflowLoading,
    workflowError,
    refetchWorkflow,
    messages,
    sendMessage,
    isSending: chatMutation.isPending,
    sendError: chatMutation.error,
    sessionId,
    conversationId: sessionId,
    sessions,
    isSessionsLoading,
    isLoadingSession,
    selectSession,
    resetSession,
    newSession: resetSession,
    activeSession,
    selectedTrace,
    setSelectedTrace,
  };
}
