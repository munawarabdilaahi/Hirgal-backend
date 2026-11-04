export interface ApiMeta {
  current_page?: number;
  last_page?: number;
  per_page?: number;
  total?: number;
}

export interface ApiSuccess<TData> {
  success: true;
  message: string;
  data: TData;
  meta?: ApiMeta;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  errors: unknown;
  error_code?: string;
}

export type ApiResponse<TData> = ApiSuccess<TData> | ApiErrorResponse;

export type AccountStatus = 'active' | 'suspended' | 'pending';

export interface ApiRole {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  is_system: boolean;
}

export interface ApiUserProfile {
  id: number;
  phone: string | null;
  job_title: string | null;
  department: string | null;
  bio: string | null;
  notification_preferences: Record<string, unknown>;
  theme_preference: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface ApiUser {
  id: number;
  name: string;
  email: string;
  account_status: AccountStatus;
  avatar_url: string | null;
  timezone: string;
  email_verified_at?: string | null;
  last_login_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  profile?: ApiUserProfile | null;
  roles?: ApiRole[];
  permissions?: string[];
}

export interface AuthTokenData {
  access_token: string;
  token_type: 'Bearer';
  user: ApiUser;
}

export interface LoginRequest {
  email: string;
  password: string;
  device_name?: string;
}
