import { describe, expect, it } from 'vitest';
import {
  formatRelativeTime,
  getNotificationIcon,
  resolveNotificationTarget,
} from './notification-navigation';
import {
  CalendarDays,
  CheckSquare,
  Clock,
  FolderKanban,
  MessageSquareText,
} from 'lucide-react';
import type { NotificationItem } from '@/services/api/notificationApi';

describe('notification navigation resolver', () => {
  it('resolves task destination with task query parameter', () => {
    const item: NotificationItem = {
      id: '1',
      type: 'App\\Notifications\\TaskNotification',
      data: {
        task_uuid: 'task-123',
      },
      read_at: null,
      created_at: null,
    };

    const target = resolveNotificationTarget(item);
    expect(target).toEqual({
      pathname: '/tasks',
      search: '?task=task-123',
    });
  });

  it('resolves project destination', () => {
    const item: NotificationItem = {
      id: '2',
      type: 'App\\Notifications\\ProjectNotification',
      data: {
        project_uuid: 'proj-456',
      },
      read_at: null,
      created_at: null,
    };

    const target = resolveNotificationTarget(item);
    expect(target).toEqual({
      pathname: '/projects/proj-456',
    });
  });

  it('resolves appointment destination with hash anchor', () => {
    const item: NotificationItem = {
      id: '3',
      type: 'App\\Notifications\\AppointmentNotification',
      data: {
        appointment_uuid: 'appt-789',
      },
      read_at: null,
      created_at: null,
    };

    const target = resolveNotificationTarget(item);
    expect(target).toEqual({
      pathname: '/appointments',
      search: '?appointment=appt-789',
      hash: '#appointment-details',
    });
  });

  it('falls back safely to inbox when no specific resource is present', () => {
    const item: NotificationItem = {
      id: '4',
      type: 'App\\Notifications\\Unknown',
      data: {},
      read_at: null,
      created_at: null,
    };

    const target = resolveNotificationTarget(item);
    expect(target).toEqual({
      pathname: '/notifications',
    });
  });
});

describe('notification icon resolver', () => {
  it('resolves correct icons based on event and resource', () => {
    expect(
      getNotificationIcon({
        id: '1',
        type: 't',
        data: { event: 'task_assigned' },
        read_at: null,
        created_at: null,
      })
    ).toBe(CheckSquare);

    expect(
      getNotificationIcon({
        id: '2',
        type: 't',
        data: { event: 'task_reminder' },
        read_at: null,
        created_at: null,
      })
    ).toBe(Clock);

    expect(
      getNotificationIcon({
        id: '3',
        type: 't',
        data: { event: 'project_member_added' },
        read_at: null,
        created_at: null,
      })
    ).toBe(FolderKanban);

    expect(
      getNotificationIcon({
        id: '4',
        type: 't',
        data: { event: 'invitation' },
        read_at: null,
        created_at: null,
      })
    ).toBe(CalendarDays);

    expect(
      getNotificationIcon({
        id: '5',
        type: 't',
        data: { event: 'user_mentioned' },
        read_at: null,
        created_at: null,
      })
    ).toBe(MessageSquareText);
  });
});

describe('formatRelativeTime', () => {
  it('formats recent and older dates', () => {
    expect(formatRelativeTime(null)).toBe('');
    expect(formatRelativeTime(new Date().toISOString())).toBe('just now');

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    expect(formatRelativeTime(tenMinutesAgo)).toBe('10m ago');

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(twoHoursAgo)).toBe('2h ago');
  });
});
