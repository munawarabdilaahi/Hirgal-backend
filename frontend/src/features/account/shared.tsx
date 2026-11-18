import { useState, type FormEvent, type ReactNode } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormDialog, FormDialogActions } from '@/components/ui/form-dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiValidationErrors, getSafeErrorMessage } from '@/features/auth/auth-validation';

export function SettingsCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
      {footer ? <div className="border-t px-6 py-4">{footer}</div> : null}
    </Card>
  );
}

export function formatDateTime(value: string | null | undefined, format?: string, timeFormat?: string): string {
  if (!value) {
    return 'Unavailable';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unavailable';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const datePart = format === 'd/m/Y'
    ? `${day}/${month}/${year}`
    : format === 'm/d/Y'
      ? `${month}/${day}/${year}`
      : `${year}-${month}-${day}`;
  const timePart = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: timeFormat === '12h',
  }).format(date);

  return `${datePart}, ${timePart}`;
}

export function LoadingRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="grid gap-3" role="status" aria-label="Loading account information">
      {Array.from({ length: rows }, (_, row) => <Skeleton key={row} className="h-12 rounded-md" />)}
    </div>
  );
}

export function QueryError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Alert role="alert" variant="destructive">
      {message} <Button variant="link" onClick={onRetry}>Retry</Button>
    </Alert>
  );
}

export function PasswordAction({
  title,
  description,
  action,
  onClose,
  execute,
  closeOnSuccess = true,
}: {
  title: string;
  description: string;
  action: string;
  onClose: () => void;
  execute: (password: string) => Promise<void>;
  closeOnSuccess?: boolean;
}) {
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    setErrors({});
    try {
      await execute(password);
      if (closeOnSuccess) {
        onClose();
      }
    } catch (caught) {
      const validation = getApiValidationErrors(caught);
      setErrors(validation);
      if (!Object.keys(validation).length) {
        setError(getSafeErrorMessage(caught));
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <FormDialog title={title} description={description} onClose={onClose} pending={pending}>
      <form className="space-y-4" onSubmit={(event) => void submit(event)}>
        {error ? <Alert variant="destructive" role="alert">{error}</Alert> : null}
        <FormField htmlFor="settings-current-password" label="Current password" error={errors.current_password} required>
          {(control) => (
            <Input
              {...control}
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          )}
        </FormField>
        <FormDialogActions submitLabel={action} pending={pending} />
      </form>
    </FormDialog>
  );
}
