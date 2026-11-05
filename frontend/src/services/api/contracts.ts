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

export type GlobalRoleSlug =
  | 'system-admin'
  | 'project-manager'
  | 'team-leader'
  | 'member';

export type ProjectContextRole = 'owner' | 'lead' | 'member' | 'viewer';

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

export interface ApiDirectoryUser {
  id: number;
  name: string;
  email: string;
  avatar_url: string | null;
  timezone: string;
  job_title: string | null;
  department: string | null;
}

export interface ApiPaginatedResponse<TData> extends ApiSuccess<TData[]> {
  meta: Required<ApiMeta>;
}

export interface UserListFilters {
  page?: number;
  per_page?: number;
  search?: string;
  status?: AccountStatus;
  role?: string;
  sort_by?: 'id' | 'name' | 'email' | 'created_at' | 'last_login_at';
  sort_direction?: 'asc' | 'desc';
}

export interface UserDirectoryFilters {
  page?: number;
  per_page?: number;
  search?: string;
  department?: string;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  timezone?: string | null;
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

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  token: string;
  password: string;
  password_confirmation: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  password: string;
  password_confirmation: string;
  logout_other_devices?: boolean;
}

export interface UpdateProfileRequest {
  name?: string;
  timezone?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  job_title?: string | null;
  department?: string | null;
  bio?: string | null;
  theme_preference?: 'light' | 'dark' | 'system';
  notification_preferences?: Record<string, unknown>;
}
