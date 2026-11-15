import { NativeSelect } from '@/components/ui/native-select';
import { FormDialog, FormDialogActions } from '@/components/ui/form-dialog';
import { useEffect, useState, type ReactNode } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/features/auth/auth-hooks';
import { hasPermission } from '@/features/auth/permissions';
import { useHabit, useSaveHabit } from '../habit-queries';
import {
  HABIT_TARGET_DAYS,
  habitErrorMessage,
  habitFormSchema,
  habitTargetDayLabel,
  type HabitFormValues,
} from '../habit-validation';
import type { SaveHabitRequest } from '@/services/api/contracts';

export function HabitFormDialog({ habitUuid, onClose, onSaved }: {
  habitUuid?: string;
  onClose: () => void;
  onSaved?: (uuid: string) => void;
}) {
  const { user } = useAuth();
  const canManage = hasPermission(user, 'habits.manage');
  const existing = useHabit(habitUuid ?? '', canManage);
  const save = useSaveHabit(habitUuid);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const form = useForm<HabitFormValues>({
    defaultValues: {
      title: '',
      description: '',
      frequency: 'daily',
      target_days: [],
      color: '#3B82F6',
    },
  });
  const seeded = existing.data;
  const resetForm = form.reset;
  const frequency = useWatch({ control: form.control, name: 'frequency' });
  const targetDays = useWatch({ control: form.control, name: 'target_days' });

  useEffect(() => {
    if (seeded) {
      resetForm({
        title: seeded.title,
        description: seeded.description ?? '',
        frequency: seeded.frequency,
        target_days: seeded.target_days ?? [],
        color: seeded.color ?? '#3B82F6',
      });
    }
  }, [resetForm, seeded]);

  function dialog(content: ReactNode) {
    return (
      <FormDialog
        title={habitUuid ? 'Edit habit' : 'Create habit'}
        description={habitUuid ? 'Update the habit and when it is tracked.' : 'Define a habit and choose when to track it.'}
        pending={save.isPending}
        onClose={onClose}
        wide
      >
        {content}
      </FormDialog>
    );
  }

  if (!canManage) {
    return dialog(
      <ErrorState
        description={
          habitUuid
            ? 'Editing habits requires the habits manage permission.'
            : 'Your account cannot create habits.'
        }
        title={habitUuid ? 'Editing unavailable' : 'Creation unavailable'}
      />
    );
  }
  if (habitUuid && existing.isPending) {
    return dialog(
      <LoadingState label="Loading habit" layout="form" className="mx-auto max-w-3xl" />
    );
  }
  if (habitUuid && existing.isError) {
    return dialog(
      <ErrorState
        description={habitErrorMessage(existing.error)}
        onRetry={() => void existing.refetch()}
        title="Habit unavailable"
      />
    );
  }
  if (habitUuid && !seeded) {
    return dialog(<ErrorState description="This habit is unavailable." title="Habit unavailable" />);
  }

  async function submit(values: HabitFormValues): Promise<void> {
    const parsed = habitFormSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
        ),
      );
      return;
    }
    setErrors({});
    const request: SaveHabitRequest = {
      title: parsed.data.title,
      description: parsed.data.description || null,
      frequency: parsed.data.frequency,
      target_days: parsed.data.target_days,
      color: parsed.data.color,
    };
    try {
      const habit = await save.mutateAsync(request);
      if (onSaved) onSaved(habit.uuid);
      else onClose();
    } catch {
      return;
    }
  }

  return dialog(
    <form
      className="space-y-5"
      noValidate
      onSubmit={form.handleSubmit(submit)}
    >
      <Field error={errors.title} label="Habit title">
        <Input {...form.register('title')} autoComplete="off" />
      </Field>
      <Field error={errors.description} label="Description">
        <Textarea {...form.register('description')} rows={4} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field error={errors.frequency} label="Frequency">
          <NativeSelect
            className="w-full"
            {...form.register('frequency')}
          >
            <option value="daily">Daily</option>
            <option value="custom">Custom days</option>
          </NativeSelect>
        </Field>
        <Field error={errors.color} label="Color">
          <Input defaultValue="#3B82F6" type="color" {...form.register('color')} />
        </Field>
      </div>
      {frequency === 'custom' ? (
        <div className="space-y-1.5">
          <p className="text-sm font-medium">
            Target days
            <span aria-hidden="true" className="ml-1 text-destructive">
              *
            </span>
          </p>
          <div className="flex flex-wrap gap-3">
            {HABIT_TARGET_DAYS.map((day) => (
              <label className="flex items-center gap-2 text-sm font-medium" key={day}>
                <Checkbox
                  aria-label={habitTargetDayLabel(day)}
                  checked={targetDays.includes(day)}
                  onCheckedChange={(checked) => {
                    const next =
                      checked === true
                        ? [...targetDays, day]
                        : targetDays.filter((value) => value !== day);
                    form.setValue('target_days', next, { shouldValidate: true });
                  }}
                />
                {habitTargetDayLabel(day)}
              </label>
            ))}
          </div>
          {errors.target_days ? (
            <p className="text-xs text-destructive" role="alert">
              {errors.target_days}
            </p>
          ) : null}
        </div>
      ) : null}
      {save.isError ? (
        <p className="text-sm text-destructive" role="alert">
          {habitErrorMessage(save.error)}
        </p>
      ) : null}
      <FormDialogActions pending={save.isPending} submitLabel={habitUuid ? 'Save changes' : 'Create habit'} />
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error: string | undefined;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5 text-sm font-medium">
      {label}
      {children}
      {error ? (
        <span className="block text-xs font-normal text-destructive" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}
