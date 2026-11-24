import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  normalizeRealtimePayload,
  useRealtimeNotifications,
} from './useRealtimeNotifications';
import { getEcho } from '@/services/realtime/echo';

const mockToast = vi.fn();
vi.mock('sonner', () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

const mockChannel = {
  listen: vi.fn().mockReturnThis(),
  notification: vi.fn().mockReturnThis(),
  stopListening: vi.fn().mockReturnThis(),
};

const mockEcho = {
  private: vi.fn().mockReturnValue(mockChannel),
  leave: vi.fn(),
  disconnect: vi.fn(),
};

vi.mock('@/services/realtime/echo', () => ({
  getEcho: vi.fn(),
}));

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

describe('useRealtimeNotifications', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.mocked(getEcho).mockReturnValue(mockEcho as unknown as ReturnType<typeof getEcho>);
  });

  describe('normalizeRealtimePayload', () => {
    it('normalizes flat payload into a NotificationItem', () => {
      const payload = {
        id: 'notif-1',
        title: 'Task Assigned',
        message: 'You have been assigned to Hirgal QA',
        task_uuid: 'task-123',
      };

      const item = normalizeRealtimePayload(payload);

      expect(item.id).toBe('notif-1');
      expect(item.data.title).toBe('Task Assigned');
      expect(item.data.message).toBe('You have been assigned to Hirgal QA');
      expect(item.data.task_uuid).toBe('task-123');
      expect(item.read_at).toBeNull();
    });

    it('normalizes nested data payload', () => {
      const payload = {
        id: 'notif-2',
        data: {
          title: 'Project Update',
          description: 'Project settings were updated',
          project_uuid: 'project-456',
        },
      };

      const item = normalizeRealtimePayload(payload);

      expect(item.id).toBe('notif-2');
      expect(item.data.title).toBe('Project Update');
      expect(item.data.message).toBe('Project settings were updated');
      expect(item.data.project_uuid).toBe('project-456');
    });
  });

  describe('hook subscription lifecycle', () => {
    it('does not subscribe if user is not provided', () => {
      const { result } = renderHook(() => useRealtimeNotifications({ user: null }), {
        wrapper: createWrapper(queryClient),
      });

      expect(mockEcho.private).not.toHaveBeenCalled();
      expect(result.current.isSubscribed).toBe(false);
      expect(result.current.channelName).toBeNull();
    });

    it('does not subscribe if enabled is false', () => {
      const { result } = renderHook(
        () => useRealtimeNotifications({ user: { id: 7 }, enabled: false }),
        { wrapper: createWrapper(queryClient) },
      );

      expect(mockEcho.private).not.toHaveBeenCalled();
      expect(result.current.isSubscribed).toBe(false);
    });

    it('subscribes to users.{userId} private channel and listens for .notification.created', () => {
      const { result } = renderHook(
        () => useRealtimeNotifications({ user: { id: 42 } }),
        { wrapper: createWrapper(queryClient) },
      );

      expect(mockEcho.private).toHaveBeenCalledWith('users.42');
      expect(mockChannel.listen).toHaveBeenCalledWith(
        '.notification.created',
        expect.any(Function),
      );
      expect(mockChannel.notification).toHaveBeenCalledWith(expect.any(Function));
      expect(result.current.isSubscribed).toBe(true);
      expect(result.current.channelName).toBe('users.42');
    });

    it('invalidates queries, triggers callback, and displays toast upon event', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const onNotification = vi.fn();

      renderHook(
        () =>
          useRealtimeNotifications({
            user: { id: 10 },
            onNotification,
          }),
        { wrapper: createWrapper(queryClient) },
      );

      // Find the event listener passed to channel.listen
      const listenCall = mockChannel.listen.mock.calls.find(
        ([eventName]) => eventName === '.notification.created',
      );
      expect(listenCall).toBeDefined();
      const handler = listenCall?.[1] as (payload: unknown) => void;

      handler({
        id: 'notif-99',
        title: 'New Appointment',
        message: 'Team Sync at 10:00 AM',
        appointment_uuid: 'appt-123',
      });

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['notifications'] });
        expect(onNotification).toHaveBeenCalledTimes(1);
        expect(mockToast).toHaveBeenCalledWith(
          'New Appointment',
          expect.objectContaining({
            description: 'Team Sync at 10:00 AM',
            action: expect.objectContaining({
              label: 'View',
            }),
          }),
        );
      });
    });

    it('cleans up and leaves channel on unmount', () => {
      const { unmount } = renderHook(
        () => useRealtimeNotifications({ user: { id: 15 } }),
        { wrapper: createWrapper(queryClient) },
      );

      unmount();

      expect(mockChannel.stopListening).toHaveBeenCalledWith(
        '.notification.created',
        expect.any(Function),
      );
      expect(mockEcho.leave).toHaveBeenCalledWith('users.15');
    });
  });
});
