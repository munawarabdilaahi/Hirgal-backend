import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { AuthPageLayout } from '@/features/auth/components/AuthPageLayout';
import { forgotPasswordSchema, getApiValidationErrors, getSafeErrorMessage, getValidationErrors } from '@/features/auth/auth-validation';
import { authApi } from '@/services/api/authApi';

export function ForgotPasswordRoute() {
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldError(null);
    setFormError(null);

    const parsed = forgotPasswordSchema.safeParse({ email });

    if (!parsed.success) {
      setFieldError(getValidationErrors(parsed.error.issues).email ?? null);
      return;
    }

    setIsSubmitting(true);

    try {
      await authApi.forgotPassword(parsed.data);
      setSubmitted(true);
    } catch (error: unknown) {
      setFieldError(getApiValidationErrors(error).email ?? null);
      setFormError(getSafeErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthPageLayout
      description="Enter the email address associated with your account."
      footer={
        <Link className="font-medium text-primary hover:underline" to="/login">
          Return to sign in
        </Link>
      }
      title="Reset your password"
    >
      {submitted ? (
        <Alert role="status" variant="success">
          If an account matches that email address, a password reset link has been sent.
        </Alert>
      ) : (
        <form className="grid gap-5" noValidate onSubmit={(event) => void submit(event)}>
          <p className="text-sm leading-6 text-muted-foreground">
            If an account matches the address, Hirgal will send instructions to reset its password.
          </p>
          {formError ? (
            <Alert role="alert" variant="destructive">{formError}</Alert>
          ) : null}
          <FormField error={fieldError ?? undefined} htmlFor="forgot-email" label="Email address" required>
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
          <Button className="w-full" loading={isSubmitting} type="submit">
            Send reset link
          </Button>
        </form>
      )}
    </AuthPageLayout>
  );
}
