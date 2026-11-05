import { z } from 'zod';
import { ApiError } from '@/services/api/ApiError';

const email = z.string().trim().min(1, 'Enter your email address.').email(
  'Enter a valid email address.',
);

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password.'),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    email,
    token: z.string().min(1, 'The reset link is incomplete.'),
    password: z.string().min(8, 'Use at least 8 characters.'),
    password_confirmation: z.string().min(1, 'Confirm your new password.'),
  })
  .refine((values) => values.password === values.password_confirmation, {
    message: 'Passwords do not match.',
    path: ['password_confirmation'],
  });

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, 'Enter your current password.'),
    password: z.string().min(8, 'Use at least 8 characters.'),
    password_confirmation: z.string().min(1, 'Confirm your new password.'),
    logout_other_devices: z.boolean(),
  })
  .refine((values) => values.password !== values.current_password, {
    message: 'The new password must be different from your current password.',
    path: ['password'],
  })
  .refine((values) => values.password === values.password_confirmation, {
    message: 'Passwords do not match.',
    path: ['password_confirmation'],
  });

export function getValidationErrors(
  issues: readonly { path: PropertyKey[]; message: string }[],
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const issue of issues) {
    const field = issue.path[0];

    if (typeof field === 'string' && !errors[field]) {
      errors[field] = issue.message;
    }
  }

  return errors;
}

export function getApiValidationErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || typeof error.errors !== 'object' || error.errors === null) {
    return {};
  }

  const fieldErrors: Record<string, string> = {};

  for (const [field, messages] of Object.entries(error.errors)) {
    if (Array.isArray(messages) && typeof messages[0] === 'string') {
      fieldErrors[field] = messages[0];
    }
  }

  return fieldErrors;
}

export function getSafeErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === null) {
      return 'We could not reach Hirgal. Check your connection and try again.';
    }

    return error.message;
  }

  return 'Something went wrong. Please try again.';
}
