import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  workflowsApi,
  type WorkflowItem,
  type CreateWorkflowPayload,
  type UpdateWorkflowPayload,
} from '../lib/api';
import { projectKeys } from './useProjects';

export const workflowKeys = {
  all: ['workflows'] as const,
  lists: () => [...workflowKeys.all, 'list'] as const,
  list: (projectId: string) => [...workflowKeys.lists(), projectId] as const,
  details: () => [...workflowKeys.all, 'detail'] as const,
  detail: (projectId: string, version: string) =>
    [...workflowKeys.details(), projectId, version] as const,
};

export function useWorkflows(projectId: string) {
  return useQuery<WorkflowItem[], Error>({
    queryKey: workflowKeys.list(projectId),
    queryFn: () => workflowsApi.list(projectId),
    enabled: Boolean(projectId),
    staleTime: 30 * 1000,
  });
}

export function useWorkflow(projectId: string, version: string) {
  return useQuery<WorkflowItem, Error>({
    queryKey: workflowKeys.detail(projectId, version),
    queryFn: () => workflowsApi.get(projectId, version),
    enabled: Boolean(projectId && version),
    staleTime: 30 * 1000,
  });
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient();

  return useMutation<
    WorkflowItem,
    Error,
    { projectId: string; data: CreateWorkflowPayload }
  >({
    mutationFn: ({ projectId, data }) => workflowsApi.create(projectId, data),
    onSuccess: (_created, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.list(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

export function useUpdateWorkflow() {
  const queryClient = useQueryClient();

  return useMutation<
    WorkflowItem,
    Error,
    { projectId: string; version: string; data: UpdateWorkflowPayload }
  >({
    mutationFn: ({ projectId, version, data }) =>
      workflowsApi.update(projectId, version, data),
    onSuccess: (_updated, { projectId, version }) => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.list(projectId) });
      queryClient.invalidateQueries({
        queryKey: workflowKeys.detail(projectId, version),
      });
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
    },
  });
}

export function useMakeLiveWorkflow() {
  const queryClient = useQueryClient();

  return useMutation<
    WorkflowItem,
    Error,
    { projectId: string; version: string }
  >({
    mutationFn: ({ projectId, version }) =>
      workflowsApi.makeLive(projectId, version),
    onSuccess: (_liveWorkflow, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.list(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

export function useDeleteWorkflow() {
  const queryClient = useQueryClient();

  return useMutation<
    { success: boolean; message: string },
    Error,
    { projectId: string; version: string }
  >({
    mutationFn: ({ projectId, version }) =>
      workflowsApi.delete(projectId, version),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.list(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
    },
  });
}
