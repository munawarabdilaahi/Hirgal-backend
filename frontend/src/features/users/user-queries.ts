import { useQuery } from '@tanstack/react-query';
import { userApi } from '@/services/api/userApi';
import type {
  UserDirectoryFilters,
  UserListFilters,
} from '@/services/api/contracts';

export const userQueryKeys = {
  all: ['users'] as const,
  lists: () => [...userQueryKeys.all, 'list'] as const,
  administrativeList: (filters: UserListFilters) =>
    [...userQueryKeys.lists(), 'administrative', filters] as const,
  directoryList: (filters: UserDirectoryFilters) =>
    [...userQueryKeys.lists(), 'directory', filters] as const,
  details: () => [...userQueryKeys.all, 'detail'] as const,
  detail: (userId: number) => [...userQueryKeys.details(), userId] as const,
};

export function useAdministrativeUsers(filters: UserListFilters, enabled = true) {
  return useQuery({
    queryKey: userQueryKeys.administrativeList(filters),
    queryFn: () => userApi.listUsers(filters),
    enabled,
  });
}

export function useUserDirectory(filters: UserDirectoryFilters, enabled = true) {
  return useQuery({
    queryKey: userQueryKeys.directoryList(filters),
    queryFn: () => userApi.listDirectory(filters),
    enabled,
  });
}

export function useUserDetails(userId: number) {
  return useQuery({
    queryKey: userQueryKeys.detail(userId),
    queryFn: () => userApi.getUser(userId),
    enabled: Number.isInteger(userId) && userId > 0,
  });
}
