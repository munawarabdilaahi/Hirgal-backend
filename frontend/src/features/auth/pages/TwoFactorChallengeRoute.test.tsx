import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { TwoFactorChallengeForm } from '@/features/auth/pages/TwoFactorChallengeRoute';
import { ApiError } from '@/services/api/ApiError';

function renderTwoFactorChallenge({
  verify = vi.fn().mockResolvedValue(undefined),
  onCancel = vi.fn(),
  challengeToken = 'mock-challenge-token',
}: {
  verify?: (data: { code?: string; recovery_code?: string }) => Promise<void>;
  onCancel?: () => Promise<void> | void;
  challengeToken?: string;
} = {}) {
  render(
    <ThemeProvider>
      <MemoryRouter>
        <TwoFactorChallengeForm
          challengeToken={challengeToken}
          onCancel={onCancel}
          verify={verify}
        />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('TwoFactorChallengeForm minimalist 2FA redesign', () => {
  it('renders the clean 2FA interface with six-digit OTP input and actions', () => {
    renderTwoFactorChallenge();

    expect(screen.getByRole('heading', { name: 'Verify your identity' })).toBeInTheDocument();
    expect(
      screen.getByText('Enter the verification code to continue.'),
    ).toBeInTheDocument();

    const firstDigit = screen.getByLabelText(/Verification code, digit 1 of 6/);
    expect(firstDigit).toBeInTheDocument();
    expect(firstDigit).toHaveAttribute('type', 'text');
    expect(firstDigit).toHaveAttribute('inputmode', 'numeric');

    // All 6 OTP inputs present
    for (let i = 2; i <= 6; i++) {
      expect(screen.getByLabelText(new RegExp(`Digit ${i} of 6`))).toBeInTheDocument();
    }

    expect(screen.getByRole('button', { name: 'Verify' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Resend code' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use a recovery code' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to sign in' })).toBeInTheDocument();

    // Redundant text and promotional messages must be removed
    expect(screen.queryByText(/Bring your team’s work into focus/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Work & Project Management/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Clear priorities/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Lost access to your authenticator device/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Contact support/i)).not.toBeInTheDocument();
  });

  it('supports typing individual digits with automatic focus advancement', async () => {
    const verify = vi.fn().mockResolvedValue(undefined);
    renderTwoFactorChallenge({ verify });

    const digit1 = screen.getByLabelText(/Verification code, digit 1 of 6/);
    const digit2 = screen.getByLabelText(/Digit 2 of 6/);
    const digit3 = screen.getByLabelText(/Digit 3 of 6/);
    const digit4 = screen.getByLabelText(/Digit 4 of 6/);
    const digit5 = screen.getByLabelText(/Digit 5 of 6/);
    const digit6 = screen.getByLabelText(/Digit 6 of 6/);

    fireEvent.change(digit1, { target: { value: '1' } });
    fireEvent.change(digit2, { target: { value: '2' } });
    fireEvent.change(digit3, { target: { value: '3' } });
    fireEvent.change(digit4, { target: { value: '4' } });
    fireEvent.change(digit5, { target: { value: '5' } });
    fireEvent.change(digit6, { target: { value: '6' } });

    const submitBtn = screen.getByRole('button', { name: 'Verify' });
    expect(submitBtn).toBeEnabled();

    fireEvent.click(submitBtn);

    await waitFor(() => expect(verify).toHaveBeenCalledTimes(1));
    expect(verify).toHaveBeenCalledWith({ code: '123456' });
  });

  it('supports pasting a complete six-digit verification code', async () => {
    const verify = vi.fn().mockResolvedValue(undefined);
    renderTwoFactorChallenge({ verify });

    const digit1 = screen.getByLabelText(/Verification code, digit 1 of 6/);
    fireEvent.paste(digit1, {
      clipboardData: {
        getData: () => '987654',
      },
    });

    const submitBtn = screen.getByRole('button', { name: 'Verify' });
    expect(submitBtn).toBeEnabled();

    fireEvent.click(submitBtn);

    await waitFor(() => expect(verify).toHaveBeenCalledTimes(1));
    expect(verify).toHaveBeenCalledWith({ code: '987654' });
  });

  it('triggers resend code cooldown feedback', () => {
    renderTwoFactorChallenge();

    const resendBtn = screen.getByRole('button', { name: 'Resend code' });
    fireEvent.click(resendBtn);

    expect(screen.getByText('Check your authenticator app for the current six-digit code.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Resend code in \d+s/ })).toBeDisabled();
  });

  it('allows switching to recovery code mode and submitting', async () => {
    const verify = vi.fn().mockResolvedValue(undefined);
    renderTwoFactorChallenge({ verify });

    // Switch to recovery code mode
    fireEvent.click(screen.getByRole('button', { name: 'Use a recovery code' }));

    expect(
      screen.getByText('Enter your emergency recovery code to continue.'),
    ).toBeInTheDocument();
    const recoveryInput = screen.getByLabelText(/Recovery code/);
    expect(recoveryInput).toBeInTheDocument();

    fireEvent.change(recoveryInput, { target: { value: 'ABCD-1234' } });

    const submitBtn = screen.getByRole('button', { name: 'Verify' });
    expect(submitBtn).toBeEnabled();

    fireEvent.click(submitBtn);

    await waitFor(() => expect(verify).toHaveBeenCalledTimes(1));
    expect(verify).toHaveBeenCalledWith({ recovery_code: 'ABCD-1234' });

    // Switch back
    fireEvent.click(screen.getByRole('button', { name: 'Use verification code' }));
    expect(screen.getByLabelText(/Verification code, digit 1 of 6/)).toBeInTheDocument();
  });

  it('displays API validation errors on code failure', async () => {
    const apiError = new ApiError('The authentication code is invalid or has expired.', 422, 'VALIDATION_ERROR', {
      code: ['The authentication code is invalid or has expired.'],
    });
    const verify = vi.fn().mockRejectedValue(apiError);

    renderTwoFactorChallenge({ verify });

    const digit1 = screen.getByLabelText(/Verification code, digit 1 of 6/);
    fireEvent.paste(digit1, {
      clipboardData: {
        getData: () => '111222',
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    expect(
      await screen.findByText('The authentication code is invalid or has expired.'),
    ).toBeInTheDocument();
  });

  it('triggers onCancel when Back to sign in is clicked', () => {
    const onCancel = vi.fn();
    renderTwoFactorChallenge({ onCancel });

    fireEvent.click(screen.getByRole('button', { name: 'Back to sign in' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
