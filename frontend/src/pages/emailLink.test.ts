import { describe, expect, it } from 'vitest';
import { readEmailLink } from './emailLink';

describe('issued email links', () => {
  it('reads reset tokens and email addresses from the legacy query string', () => {
    expect(readEmailLink(new URL('https://hirgal.test/reset-password?token=reset&email=name%2Btest%40example.com')))
      .toEqual({ token: 'reset', email: 'name+test@example.com' });
  });

  it.each(['?token=invite', '#token=invite'])('reads invitation tokens from %s', (suffix) => {
    expect(readEmailLink(new URL(`https://hirgal.test/invitations/accept${suffix}`)).token).toBe('invite');
  });
});
