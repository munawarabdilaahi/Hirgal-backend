export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: 'Very weak' | 'Weak' | 'Fair' | 'Strong' | 'Very strong';
  checks: { id: string; label: string; met: boolean }[];
}

export function passwordStrength(password: string): PasswordStrength {
  const checks = [
    { id: 'length', label: 'At least 12 characters', met: password.length >= 12 },
    { id: 'lower-upper', label: 'Upper and lowercase letters', met: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { id: 'number', label: 'At least one number', met: /\d/.test(password) },
    { id: 'symbol', label: 'At least one symbol', met: /[^A-Za-z0-9]/.test(password) },
  ];

  let score = 0;
  if (password.length > 0) {
    score = 1;
  }
  if (password.length >= 8) {
    score = 2;
  }
  const met = checks.filter((check) => check.met).length;
  if (password.length >= 8 && met >= 3) {
    score = 3;
  }
  if (checks.every((check) => check.met) && password.length >= 12) {
    score = 4;
  }

  const labels: PasswordStrength['label'][] = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'];

  return { score: score as PasswordStrength['score'], label: labels[score] ?? 'Very weak', checks };
}

export const strengthColors = ['bg-muted', 'bg-destructive', 'bg-warning', 'bg-info', 'bg-success'] as const;
