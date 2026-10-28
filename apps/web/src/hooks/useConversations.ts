import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  conversationsApi,
  type ConversationItem,
  type ConversationsResponse,
  type SendMessageResponse,
} from '../lib/api';

export const CONVERSATIONS_QUERY_KEY = 'conversations';
export const CONVERSATION_QUERY_KEY = 'conversation';

export function useConversations(projectId: string) {
  return useQuery<ConversationsResponse, Error>({
    queryKey: [CONVERSATIONS_QUERY_KEY, projectId],
    queryFn: () => conversationsApi.list(projectId),
    enabled: Boolean(projectId),
    staleTime: 30000,
  });
}

export function useConversation(
  projectId: string,
  conversationId: string | null,
  params?: { page?: number; limit?: number },
) {
  return useQuery<ConversationItem, Error>({
    queryKey: [
      CONVERSATION_QUERY_KEY,
      projectId,
      conversationId,
      params?.page,
      params?.limit,
    ],
    queryFn: () => conversationsApi.get(projectId, conversationId!, params),
    enabled: Boolean(projectId && conversationId),
    staleTime: 10000,
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();

  return useMutation<
    ConversationItem,
    Error,
    { projectId: string; name?: string }
  >({
    mutationFn: ({ projectId, name }) =>
      conversationsApi.create(projectId, { name }),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({
        queryKey: [CONVERSATIONS_QUERY_KEY, projectId],
      });
    },
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation<
    SendMessageResponse,
    Error,
    {
      projectId: string;
      conversationId: string;
      message: string;
      currentWorkflow?: any;
    }
  >({
    mutationFn: ({ projectId, conversationId, message, currentWorkflow }) =>
      conversationsApi.sendMessage(projectId, conversationId, {
        message,
        currentWorkflow,
      }),
    onSuccess: (_, { projectId, conversationId }) => {
      queryClient.invalidateQueries({
        queryKey: [CONVERSATION_QUERY_KEY, projectId, conversationId],
      });
      queryClient.invalidateQueries({
        queryKey: [CONVERSATIONS_QUERY_KEY, projectId],
      });
    },
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();

  return useMutation<
    { success: boolean; message: string },
    Error,
    { projectId: string; conversationId: string }
  >({
    mutationFn: ({ projectId, conversationId }) =>
      conversationsApi.delete(projectId, conversationId),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({
        queryKey: [CONVERSATIONS_QUERY_KEY, projectId],
      });
    },
  });
}
