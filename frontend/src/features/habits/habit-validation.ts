import { z } from 'zod';

export const HABIT_TARGET_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export const habitFormSchema = z
  .object({
    title: z.string().trim().min(1, 'Enter a habit title.').max(255, 'Use 255 characters or fewer.'),
    description: z.string().max(1000, 'Use 1000 characters or fewer.'),
    frequency: z.enum(['daily', 'custom']),
    target_days: z.array(z.enum(HABIT_TARGET_DAYS)),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Choose a valid color.'),
  })
  .refine((values) => values.frequency !== 'custom' || values.target_days.length > 0, {
    message: 'Custom habits require at least one weekday.',
    path: ['target_days'],
  });

export type HabitFormValues = z.infer<typeof habitFormSchema>;

export function habitTargetDayLabel(day: (typeof HABIT_TARGET_DAYS)[number]): string {
  return day.charAt(0).toUpperCase() + day.slice(1);
}

export function habitErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = error.status;
    if (status === 401) return 'Your session has expired. Sign in again to continue.';
    if (status === 403) return 'You no longer have permission to manage habits.';
    if (status === 404) return 'This habit is unavailable or outside your access scope.';
    if (status === 422) {
      if ('errors' in error && typeof error.errors === 'object' && error.errors !== null) {
        const firstMessage = Object.values(error.errors).find((value) => typeof value === 'string');
        if (typeof firstMessage === 'string') return firstMessage;
      }
      return 'The habit details were rejected. Review the fields and try again.';
    }
    if (status === 429) return 'Too many requests. Wait a moment and try again.';
  }
  return 'Hirgal could not complete this request. Check your connection and try again.';
}
