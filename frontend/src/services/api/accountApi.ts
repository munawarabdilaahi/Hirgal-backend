import { apiClient } from '@/services/api/apiClient';
import type {
  AccountExport,
  AccountSecurityEvent,
  AccountSessionList,
  ApiSuccess,
  ApiUser,
  TwoFactorConfirmation,
  TwoFactorSetup,
} from '@/services/api/contracts';

const root = '/auth/me';

export const accountApi = {
  async sessions(): Promise<AccountSessionList> {
    return (await apiClient.get<ApiSuccess<AccountSessionList>>(`${root}/sessions`)).data.data;
  },
  async activity(): Promise<AccountSecurityEvent[]> {
    return (await apiClient.get<ApiSuccess<AccountSecurityEvent[]>>(`${root}/security-activity`)).data.data;
  },
  async revoke(target: string, current_password: string): Promise<void> {
    await apiClient.post(`${root}/sessions/revoke`, { target, current_password });
  },
  async export(current_password: string): Promise<AccountExport> {
    return (await apiClient.post<ApiSuccess<AccountExport>>(`${root}/export`, { current_password })).data.data;
  },
  async uploadAvatar(avatar: Blob): Promise<ApiUser> {
    const form = new FormData();
    const filename = avatar instanceof File && avatar.name ? avatar.name : 'avatar.png';
    form.append('avatar', avatar, filename);
    return (await apiClient.post<ApiSuccess<ApiUser>>(`${root}/avatar`, form)).data.data;
  },
  async removeAvatar(): Promise<ApiUser> {
    return (await apiClient.delete<ApiSuccess<ApiUser>>(`${root}/avatar`)).data.data;
  },
  async requestEmail(email: string, current_password: string): Promise<void> {
    await apiClient.post(`${root}/email-change`, { email, current_password });
  },
  async confirmEmail(code: string, current_password: string): Promise<ApiUser> {
    return (await apiClient.post<ApiSuccess<ApiUser>>(`${root}/email-change/confirm`, { code, current_password })).data.data;
  },
  async startTwoFactor(current_password: string): Promise<TwoFactorSetup> {
    return (await apiClient.post<ApiSuccess<TwoFactorSetup>>(`${root}/two-factor/setup`, { current_password })).data.data;
  },
  async confirmTwoFactor(code: string): Promise<TwoFactorConfirmation> {
    return (await apiClient.post<ApiSuccess<TwoFactorConfirmation>>(`${root}/two-factor/confirm`, { code })).data.data;
  },
  async disableTwoFactor(code: string, current_password: string): Promise<void> {
    await apiClient.delete(`${root}/two-factor`, { data: { code, current_password } });
  },
  async regenerateRecoveryCodes(code: string, current_password: string): Promise<TwoFactorConfirmation> {
    return (
      await apiClient.post<ApiSuccess<TwoFactorConfirmation>>(`${root}/two-factor/recovery-codes`, {
        code,
        current_password,
      })
    ).data.data;
  },
  async deactivate(current_password: string): Promise<void> {
    await apiClient.post(`${root}/deactivate`, { current_password });
  },
  async deleteAccount(current_password: string, confirm: string): Promise<void> {
    await apiClient.delete(`${root}`, { data: { current_password, confirm } });
  },
};
