import { MemoryRouter } from 'react-router-dom';
import { ForgotPasswordForm } from '@/features/auth/pages/ForgotPasswordRoute';
import { submitWebForm } from './submitWebForm';

export default function ForgotPassword() {
  return (
    <MemoryRouter>
      <ForgotPasswordForm web send={(request) => submitWebForm('post', '/forgot-password', { ...request })} />
    </MemoryRouter>
  );
}
