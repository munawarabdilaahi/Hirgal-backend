import { MemoryRouter } from 'react-router-dom';
import { ResetPasswordForm } from '@/features/auth/pages/ResetPasswordRoute';
import { currentEmailLink } from './currentEmailLink';
import { submitWebForm } from './submitWebForm';

export default function ResetPassword() {
  return (
    <MemoryRouter>
      <ResetPasswordForm
        web
        initialEmail={currentEmailLink?.email ?? ''}
        resetToken={currentEmailLink?.token ?? ''}
        reset={(request) => submitWebForm('post', '/reset-password', { ...request })}
      />
    </MemoryRouter>
  );
}
