import { apiClient } from '@/services/api/apiClient';
import type { ApiSuccess, ApiUser } from '@/services/api/contracts';

interface AccountSession {
  id: string;
  kind: 'browser' | 'token';
  label: string;
  ip_address: string | null;
  last_active_at: string | null;
  created_at: string | null;
  current: boolean;
}

interface AccountEvent {
  id: number;
  description: string;
  created_at: string;
}

const root = '/auth/me';

export const accountApi = {
  async sessions() {
    return (await apiClient.get<ApiSuccess<{ sessions: AccountSession[]; tracks_browser_sessions: boolean }>>(`${root}/sessions`)).data.data;
  },
  async activity() {
    return (await apiClient.get<ApiSuccess<AccountEvent[]>>(`${root}/security-activity`)).data.data;
  },
  async revoke(target: string, current_password: string) {
    await apiClient.post(`${root}/sessions/revoke`, { target, current_password });
  },
  async export(current_password: string) {
    return (await apiClient.post<ApiSuccess<unknown>>(`${root}/export`, { current_password })).data.data;
  },
  async uploadAvatar(avatar: Blob) {
    const form = new FormData();
    form.append('avatar', avatar, 'avatar.png');
    return (await apiClient.post<ApiSuccess<ApiUser>>(`${root}/avatar`, form)).data.data;
  },
  async removeAvatar() {
    return (await apiClient.delete<ApiSuccess<ApiUser>>(`${root}/avatar`)).data.data;
  },
  async requestEmail(email: string, current_password: string) {
    await apiClient.post(`${root}/email-change`, { email, current_password });
  },
  async confirmEmail(code: string, current_password: string) {
    return (await apiClient.post<ApiSuccess<ApiUser>>(`${root}/email-change/confirm`, { code, current_password })).data.data;
  },
};
