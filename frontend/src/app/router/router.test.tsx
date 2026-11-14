import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '@/app/providers/AppProviders';
import { router } from '@/app/router/router';
import App from '@/App';
import type { ApiHabit } from '@/services/api/contracts';
import { setAccessToken } from '@/services/api/tokenStore';

const { authApi, habitApi } = vi.hoisted(() => ({
  authApi: {
    login: vi.fn(),
    getCurrentUser: vi.fn(),
    logout: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
    changePassword: vi.fn(),
    updateProfile: vi.fn(),
  },
  habitApi: {
    list: vi.fn(),
    dailyOverview: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
    restore: vi.fn(),
    remove: vi.fn(),
    logs: vi.fn(),
    logProgress: vi.fn(),
    removeLog: vi.fn(),
  },
}));

vi.mock('@/services/api/authApi', () => ({
  authApi,
  authQueryKey: ['auth', 'me'],
}));

vi.mock('@/services/api/habitApi', () => ({ habitApi }));

const sessionUser = {
  id: 1,
  name: 'Amina Hassan',
  email: 'amina@example.com',
  account_status: 'active' as const,
  avatar_url: null,
  timezone: 'Africa/Nairobi',
  roles: [{ id: 3, name: 'Member', slug: 'member', description: null, is_system: true }],
  permissions: ['users.view_directory'] as string[],
};

const editHabit: ApiHabit = {
  uuid: 'habit-uuid-1',
  title: 'Morning Meditation',
  description: 'Ten quiet minutes.',
  frequency: 'daily',
  target_days: null,
  color: '#10B981',
  is_archived: false,
  current_streak: 5,
  longest_streak: 12,
  stats: null,
  created_at: null,
  updated_at: null,
};

function renderApp() {
  render(
    <AppProviders>
      <App />
    </AppProviders>,
  );
}

describe('configured habit form route guards', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    sessionUser.permissions = ['users.view_directory'];
    authApi.getCurrentUser.mockResolvedValue(sessionUser);
    setAccessToken('session-token');
    await router.navigate('/habits/new');
  });

  it('blocks the create route for sessions without habits.manage', async () => {
    await router.navigate('/habits/new');
    renderApp();

    expect(
      await screen.findByRole('heading', { name: 'Access unavailable' }, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Create habit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Creation unavailable' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Habit title')).not.toBeInTheDocument();
    expect(habitApi.create).not.toHaveBeenCalled();
    expect(habitApi.get).not.toHaveBeenCalled();
    expect(habitApi.list).not.toHaveBeenCalled();
    expect(habitApi.dailyOverview).not.toHaveBeenCalled();
  });

  it('blocks the edit route for sessions without habits.manage', async () => {
    await router.navigate(`/habits/${editHabit.uuid}/edit`);
    renderApp();

    expect(
      await screen.findByRole('heading', { name: 'Access unavailable' }, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Edit habit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Editing unavailable' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Habit title')).not.toBeInTheDocument();
    expect(habitApi.get).not.toHaveBeenCalled();
    expect(habitApi.update).not.toHaveBeenCalled();
  });

  it('renders the create form for sessions holding habits.manage without fetching a habit', async () => {
    sessionUser.permissions = ['habits.manage'];
    await router.navigate('/habits/new');
    renderApp();

    expect(
      await screen.findByRole('heading', { name: 'Create habit' }, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Habit title')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Access unavailable' })).not.toBeInTheDocument();
    expect(habitApi.get).not.toHaveBeenCalled();
    expect(habitApi.create).not.toHaveBeenCalled();
  });

  it('renders the edit form prefilled from the habit detail for sessions holding habits.manage', async () => {
    sessionUser.permissions = ['habits.manage'];
    habitApi.get.mockResolvedValue(editHabit);
    await router.navigate(`/habits/${editHabit.uuid}/edit`);
    renderApp();

    expect(
      await screen.findByRole('heading', { name: 'Edit habit' }, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(await screen.findByDisplayValue('Morning Meditation', undefined, { timeout: 5000 })).toBeInTheDocument();
    expect(habitApi.get).toHaveBeenCalledWith(editHabit.uuid);
    expect(habitApi.update).not.toHaveBeenCalled();
  });
});
