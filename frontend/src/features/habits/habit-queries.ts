import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { habitApi } from '@/services/api/habitApi';
import type { HabitFilters, HabitLogFilters, SaveHabitLogRequest, SaveHabitRequest } from '@/services/api/contracts';

export const habitKeys = {
  all: ['habits'] as const,
  lists: () => [...habitKeys.all, 'list'] as const,
  list: (filters: HabitFilters) => [...habitKeys.lists(), filters] as const,
  detail: (uuid: string) => [...habitKeys.all, 'detail', uuid] as const,
  overview: (date: string) => [...habitKeys.all, 'overview', date] as const,
  logs: (uuid: string, filters: HabitLogFilters) => [...habitKeys.all, 'logs', uuid, filters] as const,
};

export function useHabits(filters: HabitFilters, enabled = true) {
  return useQuery({ queryKey: habitKeys.list(filters), queryFn: () => habitApi.list(filters), enabled });
}

export function useDailyOverview(date: string, enabled = true) {
  return useQuery({ queryKey: habitKeys.overview(date), queryFn: () => habitApi.dailyOverview(date), enabled });
}

export function useHabit(uuid: string, enabled = true) {
  return useQuery({ queryKey: habitKeys.detail(uuid), queryFn: () => habitApi.get(uuid), enabled: Boolean(uuid) && enabled });
}

export function useHabitLogs(uuid: string, filters: HabitLogFilters, enabled = true) {
  return useQuery({ queryKey: habitKeys.logs(uuid, filters), queryFn: () => habitApi.logs(uuid, filters), enabled: Boolean(uuid) && enabled });
}

export function useSaveHabit(uuid?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: SaveHabitRequest) => (uuid ? habitApi.update(uuid, request) : habitApi.create(request)),
    onSuccess: async (habit) => {
      await queryClient.invalidateQueries({ queryKey: habitKeys.all });
      queryClient.setQueryData(habitKeys.detail(habit.uuid), habit);
    },
  });
}

export function useHabitAction(action: 'archive' | 'restore' | 'delete') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (uuid: string) => {
      if (action === 'archive') return habitApi.archive(uuid);
      if (action === 'restore') return habitApi.restore(uuid);
      await habitApi.remove(uuid);
      return null;
    },
    onSuccess: async () => {
      if (action === 'delete') {
        await queryClient.invalidateQueries({ queryKey: habitKeys.all, refetchType: 'none' });
        return;
      }
      await queryClient.invalidateQueries({ queryKey: habitKeys.all });
    },
  });
}

export function useLogHabit(uuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: SaveHabitLogRequest) => habitApi.logProgress(uuid, request),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: habitKeys.all });
    },
  });
}

export function useRemoveHabitLog(uuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (date: string) => habitApi.removeLog(uuid, date),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: habitKeys.all });
    },
  });
}
