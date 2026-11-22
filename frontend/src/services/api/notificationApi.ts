import { apiClient } from '@/services/api/apiClient';
import type { ApiPaginatedResponse, ApiSuccess } from '@/services/api/contracts';

export interface NotificationData {
  title?: string;
  message?: string;
  description?: string;
  event?: string;
  resource_type?: 'task' | 'project' | 'appointment' | string;
  resource_id?: string;
  task_uuid?: string;
  project_uuid?: string;
  project_name?: string;
  appointment_uuid?: string;
  comment_id?: number;
  actor_id?: number;
  actor_name?: string;
  action_url?: string;
  start_time?: string;
  end_time?: string;
  timezone?: string;
  organizer_name?: string;
  context?: string;
}

export interface NotificationItem {
  id: string;
  type: string;
  data: NotificationData;
  read_at: string | null;
  created_at: string | null;
}

export interface NotificationFilters {
  page?: number;
  per_page?: number;
  status?: 'unread' | 'read' | '';
  type?: string;
}

export const notificationApi = {
  async list(filters: NotificationFilters = {}): Promise<ApiPaginatedResponse<NotificationItem>> {
    const { status, page, per_page, type } = filters;
    const response = await apiClient.get<ApiPaginatedResponse<NotificationItem>>('/notifications', {
      params: {
        page,
        per_page,
        ...(status ? { status } : {}),
        ...(type ? { type } : {}),
      },
    });
    return response.data;
  },

  async unreadCount(): Promise<{ unread_count: number }> {
    const response = await apiClient.get<ApiSuccess<{ unread_count: number }>>('/notifications/unread-count');
    return response.data.data;
  },

  async markRead(id: string): Promise<NotificationItem> {
    const response = await apiClient.patch<ApiSuccess<NotificationItem>>(`/notifications/${encodeURIComponent(id)}/read`);
    return response.data.data;
  },

  async markAllRead(): Promise<{ updated: number }> {
    const response = await apiClient.patch<ApiSuccess<{ updated: number }>>('/notifications/read-all');
    return response.data.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/notifications/${encodeURIComponent(id)}`);
  },
};
