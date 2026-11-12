import { apiClient } from '@/services/api/apiClient';
import type {
  ApiDailyOverview,
  ApiHabit,
  ApiHabitLog,
  ApiHabitWithoutStats,
  ApiPaginatedResponse,
  ApiSuccess,
  HabitFilters,
  HabitLogFilters,
  HabitLogStoreResponse,
  SaveHabitLogRequest,
  SaveHabitRequest,
} from '@/services/api/contracts';

export const habitApi = {
  async list(filters: HabitFilters): Promise<ApiPaginatedResponse<ApiHabit>> {
    const response = await apiClient.get<ApiPaginatedResponse<ApiHabit>>('/habits', { params: filters });
    return response.data;
  },
  async dailyOverview(date: string): Promise<ApiDailyOverview> {
    const response = await apiClient.get<ApiSuccess<ApiDailyOverview>>('/habits/daily-overview', { params: { date } });
    return response.data.data;
  },
  async get(uuid: string): Promise<ApiHabit> {
    const response = await apiClient.get<ApiSuccess<ApiHabit>>(`/habits/${uuid}`);
    return response.data.data;
  },
  async create(request: SaveHabitRequest): Promise<ApiHabit> {
    const response = await apiClient.post<ApiSuccess<ApiHabit>>('/habits', request);
    return response.data.data;
  },
  async update(uuid: string, request: SaveHabitRequest): Promise<ApiHabit> {
    const response = await apiClient.put<ApiSuccess<ApiHabit>>(`/habits/${uuid}`, request);
    return response.data.data;
  },
  async archive(uuid: string): Promise<ApiHabitWithoutStats> {
    const response = await apiClient.post<ApiSuccess<ApiHabitWithoutStats>>(`/habits/${uuid}/archive`);
    return response.data.data;
  },
  async restore(uuid: string): Promise<ApiHabitWithoutStats> {
    const response = await apiClient.post<ApiSuccess<ApiHabitWithoutStats>>(`/habits/${uuid}/restore`);
    return response.data.data;
  },
  async remove(uuid: string): Promise<void> {
    await apiClient.delete(`/habits/${uuid}`);
  },
  async logs(uuid: string, filters: HabitLogFilters): Promise<ApiPaginatedResponse<ApiHabitLog>> {
    const response = await apiClient.get<ApiPaginatedResponse<ApiHabitLog>>(`/habits/${uuid}/logs`, { params: filters });
    return response.data;
  },
  async logProgress(uuid: string, request: SaveHabitLogRequest): Promise<HabitLogStoreResponse> {
    const response = await apiClient.post<ApiSuccess<HabitLogStoreResponse>>(`/habits/${uuid}/logs`, request);
    return response.data.data;
  },
  async removeLog(uuid: string, date: string): Promise<void> {
    await apiClient.delete(`/habits/${uuid}/logs/${date}`);
  },
};
