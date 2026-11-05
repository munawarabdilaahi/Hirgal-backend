import { apiClient } from '@/services/api/apiClient';
import type {
  ApiDirectoryUser,
  ApiPaginatedResponse,
  ApiSuccess,
  ApiUser,
  UpdateUserRequest,
  UserDirectoryFilters,
  UserListFilters,
} from '@/services/api/contracts';

export const userApi = {
  async listUsers(filters: UserListFilters): Promise<ApiPaginatedResponse<ApiUser>> {
    const response = await apiClient.get<ApiPaginatedResponse<ApiUser>>('/users', {
      params: filters,
    });

    return response.data;
  },

  async listDirectory(
    filters: UserDirectoryFilters,
  ): Promise<ApiPaginatedResponse<ApiDirectoryUser>> {
    const response = await apiClient.get<ApiPaginatedResponse<ApiDirectoryUser>>(
      '/users/directory',
      { params: filters },
    );

    return response.data;
  },

  async getUser(userId: number): Promise<ApiUser> {
    const response = await apiClient.get<ApiSuccess<ApiUser>>(`/users/${userId}`);

    return response.data.data;
  },

  async updateUser(userId: number, request: UpdateUserRequest): Promise<ApiUser> {
    const response = await apiClient.put<ApiSuccess<ApiUser>>(`/users/${userId}`, request);

    return response.data.data;
  },

  async activateUser(userId: number): Promise<ApiUser> {
    const response = await apiClient.post<ApiSuccess<ApiUser>>(`/users/${userId}/activate`);

    return response.data.data;
  },

  async deactivateUser(userId: number): Promise<ApiUser> {
    const response = await apiClient.post<ApiSuccess<ApiUser>>(`/users/${userId}/deactivate`);

    return response.data.data;
  },
};
