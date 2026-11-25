import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { LoginForm } from '@/features/auth/pages/LoginRoute';

function renderLogin(authenticate: (credentials: { email: string; password: string }) => Promise<Record<string, string>>) {
  render(
    <ThemeProvider>
      <MemoryRouter>
        <LoginForm authenticate={authenticate} sessionMessage={null} />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('LoginForm minimalist authentication UI', () => {
  it('renders the minimalist branding, clean controls, and removes visual clutter', () => {
    renderLogin(vi.fn().mockResolvedValue({}));

    // Official Hirgal branding link with full logo containing brand text elements
    expect(screen.getByRole('link', { name: 'Hirgal home' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /HIRGAL — Work & Project Management/i })).toBeInTheDocument();

    // Clean headings
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.getByText('Sign in to continue to your workspace.')).toBeInTheDocument();

    // Standard credential controls
    expect(screen.getByLabelText(/Work email/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute('href', '/forgot-password');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();

    // Marketing section below the logo
    expect(screen.getByRole('heading', { name: /Bring your team['’]s work into focus/i })).toBeInTheDocument();
    expect(screen.getByText(/Plan projects, manage tasks, collaborate with your team, and achieve more/i)).toBeInTheDocument();
    expect(screen.getByText(/Plan smarter\. Work better\. Grow together\./i)).toBeInTheDocument();

    // Redundant text and clutter must be removed
    expect(screen.queryByText(/Clear priorities/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sign in to continue to your team workspace/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Refreshing or closing this tab/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Remember me/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Contact support/i)).not.toBeInTheDocument();

    // No 2FA code field on standard login
    expect(screen.queryByLabelText(/Authentication code/i)).not.toBeInTheDocument();
  });

  it('submits standard credentials without 2FA code field', async () => {
    const authenticate = vi.fn().mockResolvedValueOnce({ email: 'Invalid credentials.' });

    renderLogin(authenticate);
    fireEvent.change(screen.getByLabelText(/Work email/), { target: { value: 'amina@example.test' } });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'correct horse battery staple' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(authenticate).toHaveBeenCalledTimes(1));
    expect(authenticate).toHaveBeenCalledWith({
      email: 'amina@example.test',
      password: 'correct horse battery staple',
    });

    expect(await screen.findByText('Email or password is incorrect.')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Authentication code/i)).not.toBeInTheDocument();
  });
});
