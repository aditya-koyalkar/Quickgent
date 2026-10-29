import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  workflowsApi,
  type WorkflowItem,
  type LiveWorkflowChatResult,
  type NodeExecutionTraceItem,
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

export function useLiveWorkflow(projectId: string) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<NodeExecutionTraceItem[] | null>(null);

  // 1. Fetch the live workflow
  const {
    data: liveWorkflow,
    isLoading: isWorkflowLoading,
    error: workflowError,
    refetch: refetchWorkflow,
  } = useQuery<WorkflowItem>({
    queryKey: ['live-workflow', projectId],
    queryFn: () => workflowsApi.getLive(projectId),
    enabled: Boolean(projectId),
    retry: 1,
  });

  // 2. Chat mutation
  const chatMutation = useMutation<
    LiveWorkflowChatResult,
    Error,
    { message: string }
  >({
    mutationFn: ({ message }) =>
      workflowsApi.chatLive(projectId, {
        message,
        conversationId: conversationId || undefined,
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
      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId);
      }

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
    setConversationId(null);
    setMessages([]);
    setSelectedTrace(null);
  }, []);

  return {
    liveWorkflow,
    isWorkflowLoading,
    workflowError,
    refetchWorkflow,
    messages,
    sendMessage,
    isSending: chatMutation.isPending,
    sendError: chatMutation.error,
    conversationId,
    resetSession,
    selectedTrace,
    setSelectedTrace,
  };
}

