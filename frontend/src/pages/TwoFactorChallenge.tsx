import { router } from '@inertiajs/react';
import { MemoryRouter } from 'react-router-dom';
import { TwoFactorChallengeForm } from '@/features/auth/pages/TwoFactorChallengeRoute';

interface TwoFactorChallengeProps {
  challenge_token: string;
  sessionMessage?: string | null;
}

export default function TwoFactorChallenge({
  challenge_token,
  sessionMessage,
}: TwoFactorChallengeProps) {
  return (
    <MemoryRouter initialEntries={['/two-factor-challenge']}>
      <TwoFactorChallengeForm
        challengeToken={challenge_token}
        loginUrl="/login"
        onCancel={() => {
          router.post('/two-factor-challenge/cancel');
        }}
        sessionMessage={sessionMessage}
        verify={(data) =>
          new Promise((resolve, reject) => {
            router.post(
              '/two-factor-challenge',
              {
                challenge_token,
                ...(data.code ? { code: data.code } : {}),
                ...(data.recovery_code ? { recovery_code: data.recovery_code } : {}),
              },
              {
                onSuccess: () => resolve(),
                onError: (errors) => {
                  const errorObj = new Error('Verification failed.');
                  // Attach errors property so getApiValidationErrors can read it
                  (errorObj as unknown as { errors: Record<string, string[]> }).errors = Object.fromEntries(
                    Object.entries(errors).map(([key, val]) => [key, Array.isArray(val) ? val : [val]])
                  );
                  reject(errorObj);
                },
                onCancel: () => reject(new Error('Verification cancelled.')),
                onHttpException: () => {
                  reject(new Error('Verification request failed.'));
                  return false;
                },
                onNetworkError: (error) => {
                  reject(error);
                  return false;
                },
              },
            );
          })
        }
      />
    </MemoryRouter>
  );
}
