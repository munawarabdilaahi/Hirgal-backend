import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationBell } from './NotificationBell';

const { notificationApi } = vi.hoisted(() => ({
  notificationApi: {
    list: vi.fn(),
    unreadCount: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/services/api/notificationApi', () => ({
  notificationApi,
}));

function renderBell() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders bell button without badge when unread count is 0', async () => {
    notificationApi.unreadCount.mockResolvedValue({ unread_count: 0 });

    renderBell();

    const button = await screen.findByRole('button', { name: 'Notifications' });
    expect(button).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('renders unread count badge and label when unread count > 0', async () => {
    notificationApi.unreadCount.mockResolvedValue({ unread_count: 4 });

    renderBell();

    const button = await screen.findByRole('button', {
      name: 'Notifications (4 unread)',
    });
    expect(button).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('displays 99+ when unread count exceeds 99', async () => {
    notificationApi.unreadCount.mockResolvedValue({ unread_count: 142 });

    renderBell();

    const button = await screen.findByRole('button', {
      name: 'Notifications (142 unread)',
    });
    expect(button).toBeInTheDocument();
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('opens dropdown and displays notification list', async () => {
    notificationApi.unreadCount.mockResolvedValue({ unread_count: 1 });
    notificationApi.list.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'notif-1',
          type: 'App\\Notifications\\TaskNotification',
          data: {
            title: 'Task assigned to you',
            message: 'Amina assigned you to "Sprint Planning"',
            event: 'task_assigned',
            task_uuid: 'task-uuid-1',
          },
          read_at: null,
          created_at: new Date().toISOString(),
        },
      ],
      meta: { current_page: 1, last_page: 1, per_page: 10, total: 1 },
    });

    renderBell();

    const button = await screen.findByRole('button', {
      name: /notifications/i,
    });
    fireEvent.click(button);

    expect(await screen.findByText('Sprint Planning', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View all in Follow-up inbox' })).toBeInTheDocument();
  });

  it('displays empty state when there are no notifications', async () => {
    notificationApi.unreadCount.mockResolvedValue({ unread_count: 0 });
    notificationApi.list.mockResolvedValue({
      success: true,
      data: [],
      meta: { current_page: 1, last_page: 1, per_page: 10, total: 0 },
    });

    renderBell();

    const button = await screen.findByRole('button', {
      name: 'Notifications',
    });
    fireEvent.click(button);

    expect(await screen.findByText('No notifications yet')).toBeInTheDocument();
  });

  it('allows marking all notifications as read', async () => {
    notificationApi.unreadCount.mockResolvedValue({ unread_count: 2 });
    notificationApi.markAllRead.mockResolvedValue({ updated: 2 });
    notificationApi.list.mockResolvedValue({
      success: true,
      data: [],
      meta: { current_page: 1, last_page: 1, per_page: 10, total: 0 },
    });

    renderBell();

    const button = await screen.findByRole('button', {
      name: /notifications/i,
    });
    fireEvent.click(button);

    const markAllButton = await screen.findByRole('button', {
      name: /mark all read/i,
    });
    fireEvent.click(markAllButton);

    await waitFor(() => {
      expect(notificationApi.markAllRead).toHaveBeenCalledTimes(1);
    });
  });
});
