import { describe, expect, it } from 'vitest';
import { getSafeRedirectPath } from '@/features/auth/safeRedirect';

describe('getSafeRedirectPath', () => {
  it.each([
    ['/projects?filter=mine#board', '/projects?filter=mine#board'],
    [{ pathname: '/tasks', search: '?page=2', hash: '#today' }, '/tasks?page=2#today'],
  ])('preserves safe same-origin destination %j', (destination, expected) => {
    expect(getSafeRedirectPath(destination)).toBe(expected);
  });

  it.each(['https://evil.example', '//evil.example', '/\\evil.example', 42, null])(
    'rejects unsafe or malformed destination %j',
    (destination) => {
      expect(getSafeRedirectPath(destination)).toBeNull();
    },
  );
});
