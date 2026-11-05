import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectApi } from '@/services/api/projectApi';
import type { ProjectFilters, SaveProjectRequest } from '@/services/api/contracts';

export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (filters: ProjectFilters) => [...projectKeys.lists(), filters] as const,
  detail: (uuid: string) => [...projectKeys.all, 'detail', uuid] as const,
  members: (uuid: string) => [...projectKeys.all, 'members', uuid] as const,
  teams: (uuid: string) => [...projectKeys.all, 'teams', uuid] as const,
};

export function useProjects(filters: ProjectFilters, enabled = true) {
  return useQuery({ queryKey: projectKeys.list(filters), queryFn: () => projectApi.list(filters), enabled });
}

export function useProject(uuid: string) {
  return useQuery({ queryKey: projectKeys.detail(uuid), queryFn: () => projectApi.get(uuid), enabled: Boolean(uuid) });
}

export function useProjectMembers(uuid: string) {
  return useQuery({ queryKey: projectKeys.members(uuid), queryFn: () => projectApi.members(uuid), enabled: Boolean(uuid) });
}

export function useProjectTeams(uuid: string, enabled = true) {
  return useQuery({ queryKey: projectKeys.teams(uuid), queryFn: () => projectApi.teams(uuid), enabled: Boolean(uuid) && enabled });
}

export function useSaveProject(uuid?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: SaveProjectRequest) => uuid ? projectApi.update(uuid, request) : projectApi.create(request),
    onSuccess: async (project) => {
      await queryClient.invalidateQueries({ queryKey: projectKeys.all });
      queryClient.setQueryData(projectKeys.detail(project.uuid), project);
    },
  });
}

export function useProjectAction(action: 'archive' | 'remove') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (uuid: string) => {
      if (action === 'archive') {
        await projectApi.archive(uuid);
        return;
      }
      await projectApi.remove(uuid);
    },
    onSuccess: async (_result, uuid) => {
      await queryClient.invalidateQueries({ queryKey: projectKeys.all });
      if (action === 'remove') queryClient.removeQueries({ queryKey: projectKeys.detail(uuid) });
    },
  });
}
