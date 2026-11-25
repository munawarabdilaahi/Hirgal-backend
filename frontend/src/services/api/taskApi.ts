import { apiClient } from '@/services/api/apiClient';
import type {
  ApiDirectoryUser,
  ApiPaginatedResponse,
} from '@/services/api/contracts';

export interface TaskAssigneeFilters {
  project?: string | undefined;
  department?: string | undefined;
  search?: string | undefined;
  page?: number | undefined;
  per_page?: number | undefined;
}

export const taskApi = {
  async getAssignees(
    filters?: TaskAssigneeFilters,
  ): Promise<ApiPaginatedResponse<ApiDirectoryUser>> {
    const response = await apiClient.get<ApiPaginatedResponse<ApiDirectoryUser>>(
      '/tasks/assignees',
      { params: filters },
    );

    return response.data;
  },
};
