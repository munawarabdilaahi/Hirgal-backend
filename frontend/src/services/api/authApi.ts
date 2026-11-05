import { apiClient } from '@/services/api/apiClient';
import type {
  ApiSuccess,
  ApiUser,
  AuthTokenData,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  LoginRequest,
  ResetPasswordRequest,
  UpdateProfileRequest,
} from '@/services/api/contracts';

export const authQueryKey = ['auth', 'me'] as const;

export const authApi = {
  async login(request: LoginRequest): Promise<AuthTokenData> {
    const response = await apiClient.post<ApiSuccess<AuthTokenData>>(
      '/auth/login',
      request,
      { skipAuth: true },
    );

    return response.data.data;
  },

  async getCurrentUser(): Promise<ApiUser> {
    const response = await apiClient.get<ApiSuccess<ApiUser>>('/auth/me');

    return response.data.data;
  },

  async logout(): Promise<void> {
    await apiClient.post<ApiSuccess<null>>('/auth/logout');
  },

  async forgotPassword(request: ForgotPasswordRequest): Promise<string> {
    const response = await apiClient.post<ApiSuccess<null>>(
      '/auth/forgot-password',
      request,
      { skipAuth: true },
    );

    return response.data.message;
  },

  async resetPassword(request: ResetPasswordRequest): Promise<string> {
    const response = await apiClient.post<ApiSuccess<null>>(
      '/auth/reset-password',
      request,
      { skipAuth: true },
    );

    return response.data.message;
  },

  async changePassword(request: ChangePasswordRequest): Promise<string> {
    const response = await apiClient.post<ApiSuccess<null>>(
      '/auth/change-password',
      request,
    );

    return response.data.message;
  },

  async updateProfile(request: UpdateProfileRequest): Promise<ApiUser> {
    const response = await apiClient.put<ApiSuccess<ApiUser>>(
      '/auth/me/profile',
      request,
    );

    return response.data.data;
  },
};
