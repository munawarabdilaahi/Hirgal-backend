import type { NotificationItem } from '@/services/api/notificationApi';
import {
  CalendarDays,
  CheckSquare,
  CircleAlert,
  Clock,
  FolderKanban,
  MessageSquareText,
  type LucideIcon,
} from 'lucide-react';

export interface ResolvedNavigationTarget {
  pathname: string;
  search?: string;
  hash?: string;
}

export function resolveNotificationTarget(item: NotificationItem): ResolvedNavigationTarget {
  const { data } = item;

  if (data.task_uuid) {
    return {
      pathname: '/tasks',
      search: `?task=${encodeURIComponent(data.task_uuid)}`,
    };
  }

  if (data.project_uuid) {
    return {
      pathname: `/projects/${encodeURIComponent(data.project_uuid)}`,
    };
  }

  if (data.appointment_uuid) {
    return {
      pathname: '/appointments',
      search: `?appointment=${encodeURIComponent(data.appointment_uuid)}`,
      hash: '#appointment-details',
    };
  }

  if (data.action_url && data.action_url.startsWith('/')) {
    try {
      const url = new URL(data.action_url, 'https://hirgal.local');
      const target: ResolvedNavigationTarget = { pathname: url.pathname };
      if (url.search) {
        target.search = url.search;
      }
      if (url.hash) {
        target.hash = url.hash;
      }
      return target;
    } catch {
      return { pathname: data.action_url };
    }
  }

  return { pathname: '/notifications' };
}

export function getNotificationIcon(item: NotificationItem): LucideIcon {
  const event = item.data.event ?? '';
  const resourceType = item.data.resource_type ?? '';

  if (event.startsWith('task_') || resourceType === 'task') {
    if (event === 'task_reminder' || event === 'task_due_date_changed') {
      return Clock;
    }
    return CheckSquare;
  }

  if (event.startsWith('project_') || resourceType === 'project') {
    return FolderKanban;
  }

  if (event.includes('appointment') || event === 'invitation' || resourceType === 'appointment') {
    return CalendarDays;
  }

  if (event.includes('comment') || event.includes('mention')) {
    return MessageSquareText;
  }

  return CircleAlert;
}

export function formatRelativeTime(dateString: string | null): string {
  if (!dateString) {
    return '';
  }

  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 0 || diffInSeconds < 60) {
    return 'just now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}
