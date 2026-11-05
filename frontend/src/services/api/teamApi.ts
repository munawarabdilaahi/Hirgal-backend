import { apiClient } from '@/services/api/apiClient';
import type {
  ApiPaginatedResponse,
  ApiSuccess,
  ApiTeam,
  ApiTeamMember,
  SaveTeamMemberRequest,
  SaveTeamRequest,
  TeamFilters,
} from '@/services/api/contracts';

export const teamApi = {
  async list(filters: TeamFilters): Promise<ApiPaginatedResponse<ApiTeam>> {
    const response = await apiClient.get<ApiPaginatedResponse<ApiTeam>>('/teams', { params: filters });
    return response.data;
  },
  async get(uuid: string): Promise<ApiTeam> {
    const response = await apiClient.get<ApiSuccess<ApiTeam>>(`/teams/${uuid}`);
    return response.data.data;
  },
  async members(uuid: string, page = 1): Promise<ApiPaginatedResponse<ApiTeamMember>> {
    const response = await apiClient.get<ApiPaginatedResponse<ApiTeamMember>>(`/teams/${uuid}/members`, { params: { page, per_page: 100 } });
    return response.data;
  },
  async create(request: SaveTeamRequest): Promise<ApiTeam> {
    const response = await apiClient.post<ApiSuccess<ApiTeam>>('/teams', request);
    return response.data.data;
  },
  async update(uuid: string, request: SaveTeamRequest): Promise<ApiTeam> {
    const response = await apiClient.put<ApiSuccess<ApiTeam>>(`/teams/${uuid}`, request);
    return response.data.data;
  },
  async remove(uuid: string): Promise<void> {
    await apiClient.delete(`/teams/${uuid}`);
  },
  async addMember(uuid: string, request: SaveTeamMemberRequest): Promise<ApiTeamMember> {
    const response = await apiClient.post<ApiSuccess<ApiTeamMember>>(`/teams/${uuid}/members`, request);
    return response.data.data;
  },
  async updateMember(uuid: string, memberId: number, role: SaveTeamMemberRequest['role']): Promise<ApiTeamMember> {
    const response = await apiClient.put<ApiSuccess<ApiTeamMember>>(`/teams/${uuid}/members/${memberId}`, { role });
    return response.data.data;
  },
  async removeMember(uuid: string, memberId: number): Promise<void> {
    await apiClient.delete(`/teams/${uuid}/members/${memberId}`);
  },
};
