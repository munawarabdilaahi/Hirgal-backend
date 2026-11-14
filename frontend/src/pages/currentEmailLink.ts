import { readEmailLink } from './emailLink';

const emailPath = ['/reset-password', '/invitations/accept'].includes(window.location.pathname);
export const currentEmailLink = emailPath ? readEmailLink(new URL(window.location.href)) : null;

if (emailPath && (window.location.search || window.location.hash)) {
  window.history.replaceState(window.history.state, '', window.location.pathname);
}
