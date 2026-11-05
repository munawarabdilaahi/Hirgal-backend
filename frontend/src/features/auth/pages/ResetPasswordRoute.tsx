import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { AuthPageLayout } from '@/features/auth/components/AuthPageLayout';
import {
  getApiValidationErrors,
  getSafeErrorMessage,
  getValidationErrors,
  resetPasswordSchema,
} from '@/features/auth/auth-validation';
import { authApi } from '@/services/api/authApi';

export function ResetPasswordRoute() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const resetToken = searchParams.get('token') ?? '';

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);

    const parsed = resetPasswordSchema.safeParse({
      email,
      token: resetToken,
      password,
      password_confirmation: passwordConfirmation,
    });

    if (!parsed.success) {
      setFieldErrors(getValidationErrors(parsed.error.issues));
      return;
    }

    setIsSubmitting(true);

    try {
      await authApi.resetPassword(parsed.data);
      setSubmitted(true);
    } catch (error: unknown) {
      setFieldErrors(getApiValidationErrors(error));
      setFormError(getSafeErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthPageLayout
      description="Choose a new password for your Hirgal account."
      footer={
        <Link className="font-medium text-primary hover:underline" to="/login">
          Return to sign in
        </Link>
      }
      title="Create a new password"
    >
      {submitted ? (
        <Alert role="status" variant="success">
          Your password has been reset. Sign in with your new password.
        </Alert>
      ) : (
        <form className="grid gap-5" noValidate onSubmit={(event) => void submit(event)}>
          {!resetToken ? (
            <Alert role="alert" variant="warning">
              This reset link is incomplete. Request a new password reset email.
            </Alert>
          ) : null}
          {formError ? (
            <Alert role="alert" variant="destructive">{formError}</Alert>
          ) : null}
          <FormField error={fieldErrors.email} htmlFor="reset-email" label="Email address" required>
            {(controlProps) => (
              <Input
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                value={email}
                {...controlProps}
              />
            )}
          </FormField>
          <FormField error={fieldErrors.password} htmlFor="reset-password" label="New password" required>
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
            htmlFor="reset-confirm-password"
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
          <Button className="w-full" disabled={!resetToken} loading={isSubmitting} type="submit">
            Reset password
          </Button>
        </form>
      )}
    </AuthPageLayout>
  );
}
