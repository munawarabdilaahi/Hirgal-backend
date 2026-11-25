import { router } from '@inertiajs/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginForm } from '@/features/auth/pages/LoginRoute';

export default function Login({ sessionMessage }: { sessionMessage: string | null }) {
  return (
    <MemoryRouter initialEntries={['/login']}>
      <LoginForm
        authenticate={(credentials) => new Promise((resolve, reject) => {
          router.post('/login', { ...credentials }, {
            onSuccess: () => resolve({}),
            onError: (errors) => resolve(errors),
            onCancel: () => reject(new Error('Sign-in cancelled.')),
            onHttpException: () => {
              reject(new Error('Sign-in request failed.'));
              return false;
            },
            onNetworkError: (error) => {
              reject(error);
              return false;
            },
          });
        })}
        forgotPasswordUrl="/forgot-password"
        sessionMessage={sessionMessage}
      />
    </MemoryRouter>
  );
}
