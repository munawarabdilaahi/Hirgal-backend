import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { teamApi } from '@/services/api/teamApi';
import type { ApiTeamMember, SaveTeamRequest, TeamFilters } from '@/services/api/contracts';

export const teamKeys = {
  all: ['teams'] as const,
  lists: () => [...teamKeys.all, 'list'] as const,
  list: (filters: TeamFilters) => [...teamKeys.lists(), filters] as const,
  detail: (uuid: string) => [...teamKeys.all, 'detail', uuid] as const,
  members: (uuid: string, page = 1) => [...teamKeys.all, 'members', uuid, page] as const,
  allMembers: (uuid: string) => [...teamKeys.all, 'all-members', uuid] as const,
};

export function useTeams(filters: TeamFilters, enabled = true) {
  return useQuery({ queryKey: teamKeys.list(filters), queryFn: () => teamApi.list(filters), enabled });
}

export function useTeam(uuid: string) {
  return useQuery({ queryKey: teamKeys.detail(uuid), queryFn: () => teamApi.get(uuid), enabled: Boolean(uuid) });
}

export function useTeamMembers(uuid: string, page = 1) {
  return useQuery({ queryKey: teamKeys.members(uuid, page), queryFn: () => teamApi.members(uuid, page), enabled: Boolean(uuid) });
}

export function useAllTeamMembers(uuid: string) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: teamKeys.allMembers(uuid),
    queryFn: async (): Promise<ApiTeamMember[]> => {
      const firstPage = await queryClient.fetchQuery({
        queryKey: teamKeys.members(uuid, 1),
        queryFn: () => teamApi.members(uuid, 1),
      });
      const members = [...firstPage.data];

      for (let page = 2; page <= firstPage.meta.last_page; page += 1) {
        const response = await queryClient.fetchQuery({
          queryKey: teamKeys.members(uuid, page),
          queryFn: () => teamApi.members(uuid, page),
        });
        members.push(...response.data);
      }

      return members;
    },
    enabled: Boolean(uuid),
    staleTime: 30_000,
  });
}

export function useSaveTeam(uuid?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: SaveTeamRequest) => uuid ? teamApi.update(uuid, request) : teamApi.create(request),
    onSuccess: async (team) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: teamKeys.all }),
        ...(uuid ? [queryClient.invalidateQueries({ queryKey: ['projects'] })] : []),
      ]);
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
