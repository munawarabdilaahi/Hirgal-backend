import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  changePasswordSchema,
  getApiValidationErrors,
  getSafeErrorMessage,
  getValidationErrors,
} from '@/features/auth/auth-validation';
import { authApi } from '@/services/api/authApi';

export function ChangePasswordRoute() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [logoutOtherDevices, setLogoutOtherDevices] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);
    const parsed = changePasswordSchema.safeParse({
      current_password: currentPassword,
      password,
      password_confirmation: passwordConfirmation,
      logout_other_devices: logoutOtherDevices,
    });

    if (!parsed.success) {
      setFieldErrors(getValidationErrors(parsed.error.issues));
      return;
    }

    setIsSubmitting(true);

    try {
      await authApi.changePassword(parsed.data);
      setCurrentPassword('');
      setPassword('');
      setPasswordConfirmation('');
      toast.success('Your password has been updated.');
    } catch (error: unknown) {
      setFieldErrors(getApiValidationErrors(error));
      setFormError(getSafeErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Account security</p>
        <h1 className="text-2xl font-semibold tracking-tight">Change password</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Update your password using your current credentials.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            Passwords must be at least 8 characters and differ from your current password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {formError ? (
            <Alert className="mb-5" role="alert" variant="destructive">{formError}</Alert>
          ) : null}
          <form className="grid gap-5" noValidate onSubmit={(event) => void submit(event)}>
            <FormField
              error={fieldErrors.current_password}
              htmlFor="current-password"
              label="Current password"
              required
            >
              {(controlProps) => (
                <Input
                  autoComplete="current-password"
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  type="password"
                  value={currentPassword}
                  {...controlProps}
                />
              )}
            </FormField>
            <FormField error={fieldErrors.password} htmlFor="new-password" label="New password" required>
              {(controlProps) => (
                <Input
                  autoComplete="new-password"
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  value={password}
                  {...controlProps}
                />
              )}
            </FormField>
            <FormField
              error={fieldErrors.password_confirmation}
              htmlFor="confirm-new-password"
              label="Confirm new password"
              required
            >
              {(controlProps) => (
                <Input
                  autoComplete="new-password"
                  onChange={(event) => setPasswordConfirmation(event.target.value)}
                  type="password"
                  value={passwordConfirmation}
                  {...controlProps}
                />
              )}
            </FormField>
            <div className="flex items-start gap-3 rounded-lg border p-4">
              <Checkbox
                checked={logoutOtherDevices}
                id="logout-other-devices"
                onCheckedChange={(checked) => setLogoutOtherDevices(checked === true)}
              />
              <div className="grid gap-1">
                <Label htmlFor="logout-other-devices">Sign out other devices</Label>
                <p className="text-sm leading-5 text-muted-foreground">
                  The current session stays active. Other active sessions will be revoked.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button asChild variant="outline">
                <Link to="/profile">Cancel</Link>
              </Button>
              <Button loading={isSubmitting} type="submit">Update password</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
