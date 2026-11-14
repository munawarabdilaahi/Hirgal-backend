import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '@/app/providers/AppProviders';
import { apiClient } from '@/services/api/apiClient';
import type { ApiUser } from '@/services/api/contracts';
import Workspace from './Workspace';

const user = {
  id: 42,
  name: 'Amina Hassan',
  email: 'amina@example.com',
  account_status: 'active',
  avatar_url: null,
  timezone: 'UTC',
  roles: [],
  permissions: ['tasks.view'],
} as ApiUser;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('session workspace tasks', () => {
  it.each([
    ['/tasks', 'Tasks', undefined],
    ['/my-work', 'My work', 42],
  ] as const)('opens %s and requests the expected task list', async (path, heading, assignee) => {
    window.history.replaceState(null, '', path);
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: { data: [], meta: { current_page: 1, last_page: 1, total: 0, per_page: 15 } },
    });

    render(<AppProviders><Workspace user={user} frontendUrl="https://legacy.example" /></AppProviders>);

    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
    expect(await screen.findByText(assignee ? 'No assigned tasks match this view.' : 'No tasks match this view.')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/tasks', {
      params: {
        page: 1,
        assignee,
        status: undefined,
        ...(assignee ? { sort_by: 'due_date', sort_direction: 'asc' } : {}),
      },
    });
    expect(screen.getByRole('link', { name: heading })).toHaveAttribute('href', path);
  });
});
