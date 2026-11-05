import { useState, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { AuthPageLayout } from '@/features/auth/components/AuthPageLayout';
import { useAuth } from '@/features/auth/auth-hooks';
import {
  getApiValidationErrors,
  getSafeErrorMessage,
  getValidationErrors,
  loginSchema,
} from '@/features/auth/auth-validation';
import { getSafeRedirectPath } from '@/features/auth/safeRedirect';
import { ApiError } from '@/services/api/ApiError';

export function LoginRoute() {
  const { login, sessionMessage } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const parsed = loginSchema.safeParse({ email, password });

    if (!parsed.success) {
      setFieldErrors(getValidationErrors(parsed.error.issues));
      return;
    }

    setIsSubmitting(true);

    try {
      await login(parsed.data);
      navigate(getSafeRedirectPath(location.state?.from) ?? '/dashboard', {
        replace: true,
      });
    } catch (error: unknown) {
      const apiErrors = getApiValidationErrors(error);
      setFieldErrors(apiErrors);
      setFormError(
        error instanceof ApiError && error.status === 422 && apiErrors.email === 'Invalid credentials.'
          ? 'Email or password is incorrect.'
          : getSafeErrorMessage(error),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthPageLayout
      description="Sign in to continue to your team workspace."
      footer={
        <span>
          Need help accessing your account?{' '}
          <a className="font-medium text-primary underline-offset-4 hover:underline" href="mailto:support@hirgal.com">
            Contact support
          </a>
        </span>
      }
      title="Welcome back"
    >
      {sessionMessage ? (
        <Alert className="mb-4" variant="warning">
          {sessionMessage}
        </Alert>
      ) : null}
      {formError ? (
        <Alert className="mb-4" role="alert" variant="destructive">
          {formError}
        </Alert>
      ) : null}
      <form className="grid gap-5" noValidate onSubmit={(event) => void submit(event)}>
        <FormField error={fieldErrors.email} htmlFor="login-email" label="Work email" required>
          {(controlProps) => (
            <Input
              autoComplete="username"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              type="email"
              value={email}
              {...controlProps}
            />
          )}
        </FormField>
        <FormField error={fieldErrors.password} htmlFor="login-password" label="Password" required>
          {(controlProps) => (
            <div className="relative">
              <Input
                autoComplete="current-password"
                className="pr-12"
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? 'text' : 'password'}
                value={password}
                {...controlProps}
              />
              <Button
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-1 top-1 size-8"
                onClick={() => setShowPassword((value) => !value)}
                size="icon"
                type="button"
                variant="ghost"
              >
                {showPassword ? (
                  <EyeOff aria-hidden="true" className="size-4" />
                ) : (
                  <Eye aria-hidden="true" className="size-4" />
                )}
              </Button>
            </div>
          )}
        </FormField>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Checkbox aria-label="Keep me signed in for this tab" id="session-tab" disabled />
            <Label className="text-sm text-muted-foreground" htmlFor="session-tab">
              Memory-only session
            </Label>
          </div>
          <Link className="text-sm font-medium text-primary hover:underline" to="/forgot-password">
            Forgot password?
          </Link>
        </div>
        <p className="-mt-3 text-xs text-muted-foreground">
          Refreshing or closing this tab ends your session.
        </p>
        <Button className="w-full" loading={isSubmitting} type="submit">
          Sign in
        </Button>
      </form>
    </AuthPageLayout>
  );
}
