import { MemoryRouter } from 'react-router-dom';
import { AcceptInvitationForm } from '@/features/auth/pages/AcceptInvitationRoute';
import { currentEmailLink } from './currentEmailLink';
import { submitWebForm } from './submitWebForm';

export default function AcceptInvitation() {
  return (
    <MemoryRouter>
      <AcceptInvitationForm
        web
        token={currentEmailLink?.token ?? null}
        accept={(request) => submitWebForm('post', '/invitations/accept', { ...request })}
      />
    </MemoryRouter>
  );
}
