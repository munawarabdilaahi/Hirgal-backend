import { FormDialog, FormDialogActions } from '@/components/ui/form-dialog';
import { PageHeader } from '@/components/layout/primitives';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  changePasswordSchema,
  getApiValidationErrors,
  getSafeErrorMessage,
  getValidationErrors,
} from '@/features/auth/auth-validation';
import { authApi } from '@/services/api/authApi';
import { passwordStrength, strengthColors } from '@/features/auth/password-strength';

export function ChangePasswordRoute() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Change password" eyebrow="Account security" description="Update your password using your current credentials." />
      <ChangePasswordDialog initialOpen />
    </div>
  );
}

export function ChangePasswordDialog({ initialOpen = false }: { initialOpen?: boolean }) {
  const [editorOpen, setEditorOpen] = useState(initialOpen);
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
      setLogoutOtherDevices(false);
      setEditorOpen(false);
      toast.success('Your password has been updated.');
    } catch (error: unknown) {
      setFieldErrors(getApiValidationErrors(error));
      setFormError(getSafeErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button onClick={() => setEditorOpen(true)}>Change password</Button>
      {editorOpen && <FormDialog title="Change password" description="Use at least 8 characters and choose a different password from your current one." pending={isSubmitting} onClose={() => { setCurrentPassword(''); setPassword(''); setPasswordConfirmation(''); setLogoutOtherDevices(false); setFormError(null); setFieldErrors({}); setEditorOpen(false); }}>
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
            {password ? (
              <div aria-live="polite" className="-mt-2 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">Password strength</span>
                  <span className="text-muted-foreground">{passwordStrength(password).label}</span>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {[1, 2, 3, 4].map((level) => (
                    <span
                      className={`h-1.5 rounded-full ${level <= passwordStrength(password).score ? strengthColors[passwordStrength(password).score] : 'bg-muted'}`}
                      key={level}
                    />
                  ))}
                </div>
                <ul className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                  {passwordStrength(password).checks.map((check) => (
                    <li className={check.met ? 'text-success' : undefined} key={check.id}>
                      {check.met ? '✓' : '•'} {check.label}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
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
            <FormDialogActions pending={isSubmitting} submitLabel="Update password" />
          </form>
      </FormDialog>}
    </>
  );
}
