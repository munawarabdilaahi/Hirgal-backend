import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { AccountSettings } from '@/features/account/AccountSettings';
import type { ApiUser } from '@/services/api/contracts';

const { accountApiMock } = vi.hoisted(() => ({
  accountApiMock: {
    activity: vi.fn(),
    sessions: vi.fn(),
    revoke: vi.fn(),
    uploadAvatar: vi.fn(),
    removeAvatar: vi.fn(),
    requestEmail: vi.fn(),
    confirmEmail: vi.fn(),
    startTwoFactor: vi.fn(),
    confirmTwoFactor: vi.fn(),
    disableTwoFactor: vi.fn(),
    regenerateRecoveryCodes: vi.fn(),
    deactivate: vi.fn(),
    deleteAccount: vi.fn(),
    export: vi.fn(),
  },
}));

vi.mock('@/services/api/accountApi', () => ({ accountApi: accountApiMock }));

const user: ApiUser = {
  id: 12,
  name: 'Amina Yusuf',
  email: 'amina@example.test',
  account_status: 'active',
  avatar_url: null,
  timezone: 'Africa/Nairobi',
  email_verified_at: '2026-01-01T00:00:00Z',
  pending_email: null,
  two_factor_enabled: true,
  recovery_codes_remaining: 6,
  last_login_at: '2026-11-10T08:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: null,
  profile: {
    id: 4,
    phone: '+254700000000',
    job_title: 'Product lead',
    department: 'Product',
    bio: 'Building calm software.',
    notification_preferences: {
      email_notifications: true,
      in_app_notifications: true,
      security_alerts: true,
      login_alerts: true,
    },
    theme_preference: 'system',
    locale: 'en',
    date_format: 'Y-m-d',
    time_format: '24h',
    created_at: null,
    updated_at: null,
  },
  roles: [{ id: 1, name: 'Member', slug: 'member', description: null, is_system: true }],
  permissions: [],
};

function renderSettings(save = vi.fn().mockResolvedValue(undefined)) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <MemoryRouter initialEntries={['/profile']}>
          <AccountSettings
            onSignedOut={vi.fn()}
            onUserChanged={vi.fn()}
            save={save}
            user={user}
          />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
  return { save };
}

describe('AccountSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    accountApiMock.activity.mockResolvedValue([]);
    accountApiMock.sessions.mockResolvedValue({ sessions: [], tracks_browser_sessions: true });
  });

  it('saves profile details without sending read-only or derived fields', async () => {
    const { save } = renderSettings();
    fireEvent.change(screen.getByLabelText(/Full name/), { target: { value: 'Amina A. Yusuf' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledWith({
      name: 'Amina A. Yusuf',
      phone: '+254700000000',
      job_title: 'Product lead',
      department: 'Product',
      bio: 'Building calm software.',
    });
  });

  it('forces security and login alerts on when saving notification preferences', async () => {
    const { save } = renderSettings();
    fireEvent.click(screen.getByRole('button', { name: /^Notifications/ }));
    const inApp = await screen.findByRole('switch', { name: 'In-app notifications' });
    fireEvent.click(inApp);
    fireEvent.click(screen.getByRole('button', { name: 'Save preferences' }));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const payload = save.mock.calls[0]?.[0] as { notification_preferences: Record<string, boolean> };
    expect(payload.notification_preferences).toMatchObject({
      in_app_notifications: false,
      security_alerts: true,
      login_alerts: true,
    });
  });

  it('shows the enabled two-factor state and remaining recovery codes', async () => {
    renderSettings();
    fireEvent.click(screen.getByRole('button', { name: /^Security/ }));

    expect(await screen.findByText('Enabled')).toBeInTheDocument();
    expect(screen.getByText(/Recovery codes remaining: 6 of 8/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Disable' })).toBeInTheDocument();
  });

  it('revokes a browser session using its full opaque session reference', async () => {
    accountApiMock.revoke.mockResolvedValue(undefined);
    accountApiMock.sessions.mockResolvedValue({
      sessions: [
        {
          id: 'browser-current',
          kind: 'browser',
          label: 'Current browser',
          ip_address: '127.0.0.1',
          last_active_at: '2026-11-18T10:00:00Z',
          created_at: null,
          current: true,
        },
        {
          id: 'browser-other',
          kind: 'browser',
          label: 'Other browser',
          ip_address: '127.0.0.1',
          last_active_at: '2026-11-18T09:00:00Z',
          created_at: null,
          current: false,
        },
      ],
      tracks_browser_sessions: true,
    });
    renderSettings();
    fireEvent.click(screen.getByRole('button', { name: /^Sessions/ }));

    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    fireEvent.change(await screen.findByLabelText(/current password/i), { target: { value: 'Password123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign out session' }));

    await waitFor(() => expect(accountApiMock.revoke).toHaveBeenCalledWith('browser-other', 'Password123!'));
  });

  it('switches to preferences and renders appearance, date, and time controls', () => {
    renderSettings();
    fireEvent.click(screen.getByRole('button', { name: /^Preferences/ }));

    expect(screen.getByLabelText('Appearance')).toBeInTheDocument();
    expect(screen.getByLabelText('Date format')).toBeInTheDocument();
    expect(screen.getByLabelText('Time format')).toBeInTheDocument();
    expect(screen.getByText('Preview')).toBeInTheDocument();
    expect(screen.getAllByText(/2026-11-17/).length).toBeGreaterThan(0);
  });
});

