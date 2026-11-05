import { apiClient } from '@/services/api/apiClient';
import type {
  ApiPaginatedResponse,
  ApiProject,
  ApiProjectMember,
  ApiTeam,
  ApiSuccess,
  ProjectFilters,
  SaveProjectMemberRequest,
  SaveProjectRequest,
} from '@/services/api/contracts';

export const projectApi = {
  async list(filters: ProjectFilters): Promise<ApiPaginatedResponse<ApiProject>> {
    const response = await apiClient.get<ApiPaginatedResponse<ApiProject>>('/projects', { params: filters });
    return response.data;
  },
  async get(uuid: string): Promise<ApiProject> {
    const response = await apiClient.get<ApiSuccess<ApiProject>>(`/projects/${uuid}`);
    return response.data.data;
  },
  async members(uuid: string, page = 1): Promise<ApiPaginatedResponse<ApiProjectMember>> {
    const response = await apiClient.get<ApiPaginatedResponse<ApiProjectMember>>(`/projects/${uuid}/members`, { params: { page, per_page: 100 } });
    return response.data;
  },
  async teams(uuid: string): Promise<ApiSuccess<ApiTeam[]>> {
    const response = await apiClient.get<ApiSuccess<ApiTeam[]>>(`/projects/${uuid}/teams`);
    return response.data;
  },
  async allocateTeam(projectUuid: string, teamUuid: string): Promise<ApiTeam> {
    const response = await apiClient.post<ApiSuccess<ApiTeam>>(`/projects/${projectUuid}/teams/${teamUuid}`);
    return response.data.data;
  },
  async deallocateTeam(projectUuid: string, teamUuid: string): Promise<void> {
    await apiClient.delete(`/projects/${projectUuid}/teams/${teamUuid}`);
  },
  async create(request: SaveProjectRequest): Promise<ApiProject> {
    const response = await apiClient.post<ApiSuccess<ApiProject>>('/projects', request);
    return response.data.data;
  },
  async update(uuid: string, request: SaveProjectRequest): Promise<ApiProject> {
    const response = await apiClient.put<ApiSuccess<ApiProject>>(`/projects/${uuid}`, request);
    return response.data.data;
  },
  async archive(uuid: string): Promise<ApiProject> {
    const response = await apiClient.post<ApiSuccess<ApiProject>>(`/projects/${uuid}/archive`);
    return response.data.data;
  },
  async remove(uuid: string): Promise<void> {
    await apiClient.delete(`/projects/${uuid}`);
  },
  async addMember(uuid: string, request: SaveProjectMemberRequest): Promise<ApiProjectMember> {
    const response = await apiClient.post<ApiSuccess<ApiProjectMember>>(`/projects/${uuid}/members`, request);
    return response.data.data;
  },
  async updateMember(uuid: string, memberId: number, role: SaveProjectMemberRequest['role']): Promise<ApiProjectMember> {
    const response = await apiClient.put<ApiSuccess<ApiProjectMember>>(`/projects/${uuid}/members/${memberId}`, { role });
    return response.data.data;
  },
  async removeMember(uuid: string, memberId: number): Promise<void> {
    await apiClient.delete(`/projects/${uuid}/members/${memberId}`);
  },
};
