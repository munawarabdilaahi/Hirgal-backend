import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { LoginForm } from '@/features/auth/pages/LoginRoute';

function renderLogin(authenticate: (credentials: { email: string; password: string; two_factor_code?: string }) => Promise<Record<string, string>>) {
  render(
    <ThemeProvider>
      <MemoryRouter>
        <LoginForm authenticate={authenticate} sessionMessage={null} />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('LoginForm two-factor challenge', () => {
  it('reveals the authentication code field and retries with the submitted code', async () => {
    const authenticate = vi.fn()
      .mockResolvedValueOnce({ two_factor_code: 'Enter the six-digit code from your authenticator app.' })
      .mockResolvedValueOnce({});

    renderLogin(authenticate);
    fireEvent.change(screen.getByLabelText(/Work email/), { target: { value: 'amina@example.test' } });
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: 'correct horse battery staple' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    const codeField = await screen.findByLabelText(/Authentication code/);
    expect(codeField).toBeInTheDocument();

    fireEvent.change(codeField, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(authenticate).toHaveBeenCalledTimes(2));
    expect(authenticate).toHaveBeenLastCalledWith({
      email: 'amina@example.test',
      password: 'correct horse battery staple',
      two_factor_code: '123456',
    });
  });
});
