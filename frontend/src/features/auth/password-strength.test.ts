import { describe, expect, it } from 'vitest';
import { passwordStrength } from '@/features/auth/password-strength';

describe('passwordStrength', () => {
  it('scores an empty password as very weak', () => {
    expect(passwordStrength('').score).toBe(0);
  });

  it('requires length and a mix of character classes for a strong score', () => {
    const weak = passwordStrength('short');
    expect(weak.score).toBeLessThan(3);
    expect(weak.checks.find((check) => check.id === 'length')?.met).toBe(false);

    const strong = passwordStrength('Hirgal-Workspace-2026!');
    expect(strong.score).toBe(4);
    expect(strong.label).toBe('Very strong');
    expect(strong.checks.every((check) => check.met)).toBe(true);
  });

  it('does not label an eight-character password with every class as very strong', () => {
    const result = passwordStrength('Abcdef1!');
    expect(result.score).toBe(3);
    expect(result.label).toBe('Strong');
  });
});
