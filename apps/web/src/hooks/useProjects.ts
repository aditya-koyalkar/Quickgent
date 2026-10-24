import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  projectsApi,
  type ProjectItem,
  type ProjectDetail,
  type ProjectsResponse,
} from '../lib/api';

export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (params: { page?: number; limit?: number; search?: string }) =>
    [...projectKeys.lists(), params] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
};

export function useProjects(params?: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  return useQuery<ProjectsResponse, Error>({
    queryKey: projectKeys.list(params || {}),
    queryFn: () => projectsApi.list(params),
    staleTime: 60 * 1000,
  });
}

export function useProject(id: string) {
  return useQuery<ProjectDetail, Error>({
    queryKey: projectKeys.detail(id),
    queryFn: () => projectsApi.get(id),
    enabled: Boolean(id),
    staleTime: 60 * 1000,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation<ProjectItem, Error, { name?: string }>({
    mutationFn: projectsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation<
    ProjectItem,
    Error,
    { id: string; data: { name?: string; isActive?: boolean } }
  >({
    mutationFn: ({ id, data }) => projectsApi.update(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(updated.id) });
    },
  });
}
