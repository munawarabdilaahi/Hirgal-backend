import { describe, expect, it } from 'vitest';
import { hasAnyPermission, hasGlobalRole, hasPermission } from '@/features/auth/permissions';
import type { ApiUser } from '@/services/api/contracts';

const user: ApiUser = {
  id: 8,
  name: 'Project manager',
  email: 'manager@example.com',
  account_status: 'active',
  avatar_url: null,
  timezone: 'UTC',
  roles: [
    { id: 2, name: 'Project Manager', slug: 'project-manager', description: null, is_system: true },
  ],
  permissions: ['projects.view', 'tasks.view'],
};

describe('backend-derived permissions', () => {
  it('checks the permission list supplied on the authenticated user', () => {
    expect(hasPermission(user, 'projects.view')).toBe(true);
    expect(hasAnyPermission(user, ['users.view', 'tasks.view'])).toBe(true);
    expect(hasPermission(user, 'users.view')).toBe(false);
  });

  it('keeps global roles separate from project-contextual roles', () => {
    expect(hasGlobalRole(user, 'project-manager')).toBe(true);
    expect(hasGlobalRole(user, 'system-admin')).toBe(false);
    expect(hasGlobalRole(null, 'system-admin')).toBe(false);
  });

  it('does not grant permissions without verified user data', () => {
    expect(hasPermission(null, 'projects.view')).toBe(false);
    expect(hasAnyPermission(null, ['projects.view'])).toBe(false);
  });
});
