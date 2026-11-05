import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { teamApi } from '@/services/api/teamApi';
import type { SaveTeamRequest, TeamFilters } from '@/services/api/contracts';

export const teamKeys = {
  all: ['teams'] as const,
  lists: () => [...teamKeys.all, 'list'] as const,
  list: (filters: TeamFilters) => [...teamKeys.lists(), filters] as const,
  detail: (uuid: string) => [...teamKeys.all, 'detail', uuid] as const,
  members: (uuid: string) => [...teamKeys.all, 'members', uuid] as const,
};

export function useTeams(filters: TeamFilters, enabled = true) {
  return useQuery({ queryKey: teamKeys.list(filters), queryFn: () => teamApi.list(filters), enabled });
}

export function useTeam(uuid: string) {
  return useQuery({ queryKey: teamKeys.detail(uuid), queryFn: () => teamApi.get(uuid), enabled: Boolean(uuid) });
}

export function useTeamMembers(uuid: string) {
  return useQuery({ queryKey: teamKeys.members(uuid), queryFn: () => teamApi.members(uuid), enabled: Boolean(uuid) });
}

export function useSaveTeam(uuid?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: SaveTeamRequest) => uuid ? teamApi.update(uuid, request) : teamApi.create(request),
    onSuccess: async (team) => {
      await queryClient.invalidateQueries({ queryKey: teamKeys.all });
      queryClient.setQueryData(teamKeys.detail(team.uuid), team);
    },
  });
}

export function useTeamAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (uuid: string) => teamApi.remove(uuid),
    onSuccess: async (_result, uuid) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: teamKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
      ]);
      queryClient.removeQueries({ queryKey: teamKeys.detail(uuid) });
    },
  });
}
