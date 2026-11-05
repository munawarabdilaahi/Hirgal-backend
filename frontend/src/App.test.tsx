import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '@/app/providers/AppProviders';
import { router } from '@/app/router/router';
import App from '@/App';
import { clearAccessToken, setAccessToken } from '@/services/api/tokenStore';

const { authApi } = vi.hoisted(() => ({
  authApi: {
    login: vi.fn(),
    getCurrentUser: vi.fn(),
    logout: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
    changePassword: vi.fn(),
    updateProfile: vi.fn(),
  },
}));

vi.mock('@/services/api/authApi', () => ({
  authApi,
  authQueryKey: ['auth', 'me'],
}));

const activeUser = {
  id: 1,
  name: 'Amina Hassan',
  email: 'amina@example.com',
  account_status: 'active' as const,
  avatar_url: null,
  timezone: 'Africa/Nairobi',
  roles: [{ id: 3, name: 'Member', slug: 'member', description: null, is_system: true }],
  permissions: ['users.view_directory'],
};

describe('authentication routes', () => {
  beforeEach(async () => {
    clearAccessToken();
    await router.navigate('/');
    vi.clearAllMocks();
    authApi.getCurrentUser.mockResolvedValue(activeUser);
  });

  it('redirects protected pages to login and safely returns after successful login', async () => {
    authApi.login.mockResolvedValue({
      access_token: 'memory-token',
      token_type: 'Bearer',
      user: activeUser,
    });

    render(
      <AppProviders>
        <App />
      </AppProviders>,
    );

    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Work email/), {
      target: { value: 'amina@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { name: 'Welcome, Amina Hassan' })).toBeInTheDocument();
    expect(authApi.login).toHaveBeenCalledWith({
      email: 'amina@example.com',
      password: 'secret123',
    });
  });

  it('validates login fields before making an API request', async () => {
    render(
      <AppProviders>
        <App />
      </AppProviders>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Enter your email address.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(authApi.login).not.toHaveBeenCalled();
  });

  it('shows invalid credential feedback without exposing backend details', async () => {
    const { ApiError } = await import('@/services/api/ApiError');
    authApi.login.mockRejectedValue(
      new ApiError('Validation failed', 422, 'VALIDATION_ERROR', {
        email: ['Invalid credentials.'],
      }),
    );

    render(
      <AppProviders>
        <App />
      </AppProviders>,
    );
    fireEvent.change(await screen.findByLabelText(/Work email/), {
      target: { value: 'amina@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'badpass123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Email or password is incorrect.')).toBeInTheDocument();
  });

  it('submits a forgot-password request with the validated email', async () => {
    authApi.forgotPassword.mockResolvedValue('generic confirmation');
    await router.navigate('/forgot-password');

    render(
      <AppProviders>
        <App />
      </AppProviders>,
    );
    fireEvent.change(await screen.findByLabelText(/Email address/), {
      target: { value: 'amina@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'If an account matches that email address, a password reset link has been sent.',
    );
    expect(authApi.forgotPassword).toHaveBeenCalledWith({ email: 'amina@example.com' });
  });

  it('renders incomplete reset links without enabling submission', async () => {
    await router.navigate('/reset-password');

    render(
      <AppProviders>
        <App />
      </AppProviders>,
    );

    expect(await screen.findByText('This reset link is incomplete. Request a new password reset email.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset password' })).toBeDisabled();
  });

  it('submits reset credentials and reports completion', async () => {
    authApi.resetPassword.mockResolvedValue('reset');
    await router.navigate('/reset-password?token=one-time-token');

    render(
      <AppProviders>
        <App />
      </AppProviders>,
    );
    fireEvent.change(await screen.findByLabelText(/Email address/), {
      target: { value: 'amina@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^New password/), {
      target: { value: 'new-password-123' },
    });
    fireEvent.change(screen.getByLabelText(/Confirm new password/), {
      target: { value: 'new-password-123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Your password has been reset. Sign in with your new password.',
    );
    expect(authApi.resetPassword).toHaveBeenCalledWith({
      email: 'amina@example.com',
      token: 'one-time-token',
      password: 'new-password-123',
      password_confirmation: 'new-password-123',
    });
  });

  it('submits password changes after client validation', async () => {
    authApi.login.mockResolvedValue({
      access_token: 'memory-token',
      token_type: 'Bearer',
      user: activeUser,
    });
    authApi.changePassword.mockResolvedValue('changed');
    await router.navigate('/change-password');
    setAccessToken('session-token');

    render(
      <AppProviders>
        <App />
      </AppProviders>,
    );
    fireEvent.change(await screen.findByLabelText(/Current password/), {
      target: { value: 'current-password' },
    });
    fireEvent.change(screen.getByLabelText(/^New password/), {
      target: { value: 'updated-password' },
    });
    fireEvent.change(screen.getByLabelText(/Confirm new password/), {
      target: { value: 'updated-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }));

    await waitFor(() =>
      expect(authApi.changePassword).toHaveBeenCalledWith({
        current_password: 'current-password',
        password: 'updated-password',
        password_confirmation: 'updated-password',
        logout_other_devices: false,
      }),
    );
  });

  it('clears local authentication after logout fails on the server', async () => {
    const user = userEvent.setup();
    authApi.login.mockResolvedValue({
      access_token: 'memory-token',
      token_type: 'Bearer',
      user: activeUser,
    });
    authApi.logout.mockRejectedValue(new Error('Network unavailable'));

    render(
      <AppProviders>
        <App />
      </AppProviders>,
    );
    fireEvent.change(await screen.findByLabelText(/Work email/), {
      target: { value: 'amina@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByRole('heading', { name: 'Welcome, Amina Hassan' });
    await user.click(screen.getByRole('button', { name: 'Open account menu for Amina Hassan' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }));

    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(authApi.logout).toHaveBeenCalledOnce();
  });

  it('completes normal server logout and returns to the login screen', async () => {
    const user = userEvent.setup();
    authApi.login.mockResolvedValue({
      access_token: 'memory-token',
      token_type: 'Bearer',
      user: activeUser,
    });
    authApi.logout.mockResolvedValue(undefined);

    render(
      <AppProviders>
        <App />
      </AppProviders>,
    );
    fireEvent.change(await screen.findByLabelText(/Work email/), {
      target: { value: 'amina@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByRole('heading', { name: 'Welcome, Amina Hassan' });
    await user.click(screen.getByRole('button', { name: 'Open account menu for Amina Hassan' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }));

    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(authApi.logout).toHaveBeenCalledOnce();
  });

  it('submits permitted profile fields and refreshes the displayed user', async () => {
    const updatedUser = { ...activeUser, name: 'Amina Ali' };
    authApi.login.mockResolvedValue({
      access_token: 'memory-token',
      token_type: 'Bearer',
      user: activeUser,
    });
    authApi.updateProfile.mockResolvedValue(updatedUser);
    await router.navigate('/profile');
    setAccessToken('session-token');

    render(
      <AppProviders>
        <App />
      </AppProviders>,
    );
    fireEvent.change(await screen.findByLabelText(/^Name/), { target: { value: 'Amina Ali' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(authApi.updateProfile).toHaveBeenCalledWith({
        name: 'Amina Ali',
        timezone: 'Africa/Nairobi',
        phone: null,
        job_title: null,
        department: null,
        bio: null,
      }),
    );
  });

  it('keeps generic login FORBIDDEN handling separate from current-user lookup', async () => {
    const { ApiError } = await import('@/services/api/ApiError');
    authApi.login.mockRejectedValue(new ApiError('Forbidden', 403, 'FORBIDDEN'));

    render(
      <AppProviders>
        <App />
      </AppProviders>,
    );
    fireEvent.change(await screen.findByLabelText(/Work email/), {
      target: { value: 'amina@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Forbidden'));
    expect(authApi.getCurrentUser).not.toHaveBeenCalled();
  });

  it('does not render a protected feature route without its backend permission', async () => {
    await router.navigate('/projects');
    setAccessToken('session-token');

    render(
      <AppProviders>
        <App />
      </AppProviders>,
    );

    expect(await screen.findByRole('heading', { name: 'Access unavailable' })).toBeInTheDocument();
    expect(screen.queryByText(/Its screen and API integration have not been implemented/)).not.toBeInTheDocument();
  });
});
