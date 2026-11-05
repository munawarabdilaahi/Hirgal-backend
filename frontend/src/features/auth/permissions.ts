import type { ApiUser, GlobalRoleSlug } from '@/services/api/contracts';

export function hasPermission(user: ApiUser | null, permission: string): boolean {
  return user?.permissions?.includes(permission) ?? false;
}

export function hasAnyPermission(
  user: ApiUser | null,
  permissions: readonly string[],
): boolean {
  return permissions.some((permission) => hasPermission(user, permission));
}

export function hasGlobalRole(user: ApiUser | null, role: GlobalRoleSlug): boolean {
  return user?.roles?.some((userRole) => userRole.slug === role) ?? false;
}
