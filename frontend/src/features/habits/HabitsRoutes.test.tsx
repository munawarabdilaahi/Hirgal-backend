import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RequirePermission } from '@/features/auth/components/AuthRouteGuards';
import { HabitDetailsRoute } from './pages/HabitDetailsRoute';
import { HabitFormRoute } from './pages/HabitFormRoute';
import { HabitsRoute } from './pages/HabitsRoute';
import type { ApiDailyOverview, ApiHabit, ApiHabitLog } from '@/services/api/contracts';

const { habitApi, authState } = vi.hoisted(() => ({
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
  authState: {
    user: null as null | {
      id: number;
      name: string;
      email: string;
      account_status: 'active';
      avatar_url: null;
      timezone: string;
      roles: { id: number; name: string; slug: string; description: null; is_system: boolean }[];
      permissions: string[];
    },
  },
}));

vi.mock('@/services/api/habitApi', () => ({ habitApi }));
vi.mock('@/features/auth/auth-hooks', () => ({ useAuth: () => authState }));

const stats = {
  current_streak: 5,
  longest_streak: 12,
  total_completed: 30,
  total_skipped: 3,
  total_failed: 2,
  completion_rate: 85.7,
};

const habit: ApiHabit = {
  uuid: 'habit-uuid',
  title: 'Morning Meditation',
  description: 'Ten quiet minutes.',
  frequency: 'daily',
  target_days: null,
  color: '#10B981',
  is_archived: false,
  current_streak: 5,
  longest_streak: 12,
  stats,
  created_at: null,
  updated_at: null,
};

const logEntry: ApiHabitLog = {
  id: 1,
  logged_date: '2026-11-10',
  status: 'completed',
  notes: 'Felt great',
  created_at: null,
  updated_at: null,
};

function overviewWith(log: ApiHabitLog | null, isScheduled = true): ApiDailyOverview {
  return {
    date: '2026-11-10',
    timezone: 'UTC',
    habits: [{ habit, is_scheduled: isScheduled, log }],
  };
}

function renderWithProviders(ui: React.ReactNode, initialEntry = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  authState.user = {
    id: 7,
    name: 'Amina Hassan',
    email: 'amina@example.test',
    account_status: 'active',
    avatar_url: null,
    timezone: 'UTC',
    roles: [
      { id: 1, name: 'System Admin', slug: 'system-admin', description: null, is_system: true },
    ],
    permissions: ['habits.manage'],
  };
  habitApi.list.mockResolvedValue({
    success: true,
    message: 'ok',
    data: [habit],
    meta: { current_page: 1, last_page: 1, per_page: 12, total: 1 },
  });
  habitApi.dailyOverview.mockResolvedValue(overviewWith(null));
  habitApi.get.mockResolvedValue(habit);
  habitApi.create.mockResolvedValue(habit);
  habitApi.update.mockResolvedValue(habit);
  habitApi.archive.mockResolvedValue({ ...habit, is_archived: true });
  habitApi.restore.mockResolvedValue(habit);
  habitApi.remove.mockResolvedValue(undefined);
  habitApi.logs.mockResolvedValue({
    success: true,
    message: 'ok',
    data: [logEntry],
    meta: { current_page: 1, last_page: 1, per_page: 10, total: 1 },
  });
  habitApi.logProgress.mockResolvedValue({ log: logEntry, stats });
  habitApi.removeLog.mockResolvedValue(undefined);
});

describe('HabitsRoute', () => {
  it('renders authorized habits, the daily check-in and the create action', async () => {
    renderWithProviders(<HabitsRoute />);
    const habitLinks = await screen.findAllByRole('link', { name: 'Morning Meditation' });
    expect(habitLinks[0]).toHaveAttribute('href', '/habits/habit-uuid');
    expect(screen.getByRole('link', { name: 'New habit' })).toHaveAttribute('href', '/habits/new');
    expect(await screen.findByRole('heading', { name: 'Daily check-in' })).toBeInTheDocument();
    expect(screen.getByText('5 day streak')).toBeInTheDocument();
    expect(
      screen.getByRole('progressbar', { name: 'Completion rate for Morning Meditation' }),
    ).toBeInTheDocument();
    expect(habitApi.list).toHaveBeenCalledWith({ page: 1, per_page: 12, is_archived: false });
  });

  it('shows loading, empty, error and retry states', async () => {
    let resolveList: ((value: unknown) => void) | undefined;
    habitApi.list.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveList = resolve;
        }),
    );
    renderWithProviders(<HabitsRoute />);
    expect(screen.getByRole('status', { name: 'Loading habits' })).toBeInTheDocument();
    resolveList?.({
      success: true,
      message: 'ok',
      data: [],
      meta: { current_page: 1, last_page: 1, per_page: 12, total: 0 },
    });
    expect(await screen.findByText('No habits found')).toBeInTheDocument();

    habitApi.list.mockRejectedValueOnce(new Error('network'));
    const view = renderWithProviders(<HabitsRoute />);
    expect(await screen.findByText('Habits could not be loaded')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(habitApi.list).toHaveBeenCalledTimes(3));
    view.unmount();
  });

  it('submits supported archive and frequency filters', async () => {
    renderWithProviders(<HabitsRoute />);
    await screen.findAllByRole('link', { name: 'Morning Meditation' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by archive status' }), {
      target: { value: 'archived' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by frequency' }), {
      target: { value: 'daily' },
    });
    await waitFor(() =>
      expect(habitApi.list).toHaveBeenLastCalledWith({
        page: 1,
        per_page: 12,
        is_archived: true,
        frequency: 'daily',
      }),
    );
  });

  it('blocks the page without the habits manage permission', async () => {
    authState.user!.permissions = ['projects.view'];
    renderWithProviders(
      <RequirePermission permission="habits.manage">
        <HabitsRoute />
      </RequirePermission>,
    );
    expect(await screen.findByRole('heading', { name: 'Access unavailable' })).toBeInTheDocument();
    expect(habitApi.list).not.toHaveBeenCalled();
    expect(habitApi.dailyOverview).not.toHaveBeenCalled();
  });

  it('records a completed check-in for the selected date', async () => {
    habitApi.dailyOverview
      .mockResolvedValueOnce(overviewWith(null))
      .mockResolvedValue(overviewWith(logEntry));
    renderWithProviders(<HabitsRoute />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Mark Morning Meditation as completed' }),
    );
    await waitFor(() =>
      expect(habitApi.logProgress).toHaveBeenCalledWith('habit-uuid', {
        logged_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        status: 'completed',
      }),
    );
    expect(await screen.findByText('Completed')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Remove check-in for Morning Meditation' }),
    ).toBeInTheDocument();
  });

  it('removes a check-in after confirmation', async () => {
    habitApi.dailyOverview
      .mockResolvedValueOnce(overviewWith(logEntry))
      .mockResolvedValue(overviewWith(null));
    renderWithProviders(<HabitsRoute />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Remove check-in for Morning Meditation' }),
    );
    expect(await screen.findByText('Remove this check-in?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove check-in' }));
    await waitFor(() =>
      expect(habitApi.removeLog).toHaveBeenCalledWith(
        'habit-uuid',
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      ),
    );
  });

  it('hides check-in actions for habits not scheduled on the date', async () => {
    habitApi.dailyOverview.mockResolvedValue(overviewWith(null, false));
    renderWithProviders(<HabitsRoute />);
    expect(await screen.findByText('Not scheduled on this date')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Mark Morning Meditation as completed' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Mark Morning Meditation as skipped' }),
    ).not.toBeInTheDocument();
  });
});

describe('HabitFormRoute', () => {
  it('creates a validated habit and navigates to its route', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/habits/new" element={<HabitFormRoute />} />
        <Route path="/habits/:habitUuid" element={<h1>Habit destination</h1>} />
      </Routes>,
      '/habits/new',
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Create habit' }));
    expect(await screen.findByText('Enter a habit title.')).toBeInTheDocument();
    fireEvent.change(document.querySelector('[name="title"]')!, {
      target: { value: 'Read 20 pages' },
    });
    fireEvent.change(document.querySelector('[name="description"]')!, {
      target: { value: 'Before bed.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create habit' }));
    await waitFor(() =>
      expect(habitApi.create).toHaveBeenCalledWith({
        title: 'Read 20 pages',
        description: 'Before bed.',
        frequency: 'daily',
        target_days: [],
        color: expect.stringMatching(/^#3b82f6$/i),
      }),
    );
    expect(await screen.findByRole('heading', { name: 'Habit destination' })).toBeInTheDocument();
  });

  it('requires a weekday for custom habits before creating', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/habits/new" element={<HabitFormRoute />} />
      </Routes>,
      '/habits/new',
    );
    await screen.findByRole('button', { name: 'Create habit' });
    fireEvent.change(document.querySelector('[name="title"]')!, {
      target: { value: 'Gym Workout' },
    });
    fireEvent.change(document.querySelector('[name="frequency"]')!, {
      target: { value: 'custom' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create habit' }));
    expect(
      await screen.findByText('Custom habits require at least one weekday.'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mon' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create habit' }));
    await waitFor(() =>
      expect(habitApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ frequency: 'custom', target_days: ['mon'] }),
      ),
    );
  });

  it('prefills an existing habit and saves edits', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/habits/:habitUuid/edit" element={<HabitFormRoute />} />
        <Route path="/habits/:habitUuid" element={<h1>Habit destination</h1>} />
      </Routes>,
      '/habits/habit-uuid/edit',
    );
    expect(await screen.findByDisplayValue('Morning Meditation')).toBeInTheDocument();
    fireEvent.change(document.querySelector('[name="title"]')!, {
      target: { value: 'Evening Meditation' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(habitApi.update).toHaveBeenCalledWith('habit-uuid', {
        title: 'Evening Meditation',
        description: 'Ten quiet minutes.',
        frequency: 'daily',
        target_days: [],
        color: '#10B981',
      }),
    );
    expect(await screen.findByRole('heading', { name: 'Habit destination' })).toBeInTheDocument();
  });

  it('blocks creation without the habits manage permission', () => {
    authState.user!.permissions = ['projects.view'];
    renderWithProviders(
      <Routes>
        <Route path="/habits/new" element={<HabitFormRoute />} />
      </Routes>,
      '/habits/new',
    );
    expect(screen.getByRole('heading', { name: 'Creation unavailable' })).toBeInTheDocument();
    expect(habitApi.create).not.toHaveBeenCalled();
  });

  it('blocks creation at the route guard without calling create', async () => {
    authState.user!.permissions = ['projects.view'];
    renderWithProviders(
      <Routes>
        <Route
          path="/habits/new"
          element={
            <RequirePermission permission="habits.manage">
              <HabitFormRoute />
            </RequirePermission>
          }
        />
      </Routes>,
      '/habits/new',
    );
    expect(await screen.findByRole('heading', { name: 'Access unavailable' })).toBeInTheDocument();
    expect(habitApi.create).not.toHaveBeenCalled();
    expect(habitApi.get).not.toHaveBeenCalled();
  });

  it('blocks editing at the route guard without fetching or updating the habit', async () => {
    authState.user!.permissions = ['projects.view'];
    renderWithProviders(
      <Routes>
        <Route
          path="/habits/:habitUuid/edit"
          element={
            <RequirePermission permission="habits.manage">
              <HabitFormRoute />
            </RequirePermission>
          }
        />
      </Routes>,
      '/habits/habit-uuid/edit',
    );
    expect(await screen.findByRole('heading', { name: 'Access unavailable' })).toBeInTheDocument();
    expect(habitApi.get).not.toHaveBeenCalled();
    expect(habitApi.update).not.toHaveBeenCalled();
  });

  it('does not trigger the habit detail query when rendered without the permission', () => {
    authState.user!.permissions = ['projects.view'];
    renderWithProviders(
      <Routes>
        <Route path="/habits/:habitUuid/edit" element={<HabitFormRoute />} />
      </Routes>,
      '/habits/habit-uuid/edit',
    );
    expect(screen.getByRole('heading', { name: 'Editing unavailable' })).toBeInTheDocument();
    expect(habitApi.get).not.toHaveBeenCalled();
    expect(habitApi.update).not.toHaveBeenCalled();
  });
});

describe('HabitDetailsRoute', () => {
  it('loads habit details with streak statistics', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/habits/:habitUuid" element={<HabitDetailsRoute />} />
      </Routes>,
      '/habits/habit-uuid',
    );
    expect(
      await screen.findByRole('heading', { name: 'Morning Meditation' }),
    ).toBeInTheDocument();
    expect(habitApi.get).toHaveBeenCalledWith('habit-uuid');
    expect(await screen.findByText('5 days')).toBeInTheDocument();
    expect(screen.getByText('12 days')).toBeInTheDocument();
    expect(screen.getByText('85.7%')).toBeInTheDocument();
    expect(screen.getByText('30 completed')).toBeInTheDocument();
    expect(
      screen.getByRole('progressbar', { name: 'Completion rate for Morning Meditation' }),
    ).toBeInTheDocument();
  });

  it('filters habit history by status', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/habits/:habitUuid" element={<HabitDetailsRoute />} />
      </Routes>,
      '/habits/habit-uuid',
    );
    expect(await screen.findByText('2026-11-10')).toBeInTheDocument();
    expect(screen.getByText('Felt great')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter history by status' }), {
      target: { value: 'completed' },
    });
    await waitFor(() =>
      expect(habitApi.logs).toHaveBeenLastCalledWith(
        'habit-uuid',
        expect.objectContaining({ status: 'completed' }),
      ),
    );
  });

  it('requires confirmation before archiving', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/habits/:habitUuid" element={<HabitDetailsRoute />} />
      </Routes>,
      '/habits/habit-uuid',
    );
    await screen.findByRole('heading', { name: 'Morning Meditation' });
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    expect(habitApi.archive).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Archive habit' }));
    await waitFor(() => expect(habitApi.archive).toHaveBeenCalledWith('habit-uuid'));
  });

  it('deletes a habit after confirmation and returns to the list', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/habits/:habitUuid" element={<HabitDetailsRoute />} />
        <Route path="/habits" element={<h1>Habits destination</h1>} />
      </Routes>,
      '/habits/habit-uuid',
    );
    await screen.findByRole('heading', { name: 'Morning Meditation' });
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(habitApi.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete habit' }));
    await waitFor(() => expect(habitApi.remove).toHaveBeenCalledWith('habit-uuid'));
    expect(
      await screen.findByRole('heading', { name: 'Habits destination' }),
    ).toBeInTheDocument();
  });

  it('surfaces a cross-scope error when the habit is not found', async () => {
    habitApi.get.mockRejectedValueOnce({ status: 404 });
    renderWithProviders(
      <Routes>
        <Route path="/habits/:habitUuid" element={<HabitDetailsRoute />} />
      </Routes>,
      '/habits/other',
    );
    expect(
      await screen.findByText('This habit is unavailable or outside your access scope.'),
    ).toBeInTheDocument();
    expect(habitApi.logs).not.toHaveBeenCalled();
  });

  it('shows a loading state while the habit loads', async () => {
    let resolveGet: ((value: unknown) => void) | undefined;
    habitApi.get.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveGet = resolve;
        }),
    );
    renderWithProviders(
      <Routes>
        <Route path="/habits/:habitUuid" element={<HabitDetailsRoute />} />
      </Routes>,
      '/habits/habit-uuid',
    );
    expect(screen.getByRole('status', { name: 'Loading habit' })).toBeInTheDocument();
    resolveGet?.(habit);
    expect(
      await screen.findByRole('heading', { name: 'Morning Meditation' }),
    ).toBeInTheDocument();
  });
});
