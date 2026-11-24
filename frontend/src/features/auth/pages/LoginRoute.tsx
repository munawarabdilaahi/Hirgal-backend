import { useState, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
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
import type { LoginRequest } from '@/services/api/contracts';

export function LoginRoute() {
  const { login, sessionMessage } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <LoginForm
      sessionMessage={sessionMessage}
      authenticate={async (credentials) => {
        const result = await login(credentials);

        if (result.two_factor_required && result.challenge_token) {
          navigate('/two-factor-challenge', {
            state: {
              challenge_token: result.challenge_token,
              from: location.state?.from,
            },
          });
          return {};
        }

        navigate(getSafeRedirectPath(location.state?.from) ?? '/dashboard', { replace: true });
        return {};
      }}
    />
  );
}

export interface LoginFormProps {
  authenticate: (credentials: LoginRequest) => Promise<Record<string, string>>;
  sessionMessage: string | null;
  forgotPasswordUrl?: string;
}

export function LoginForm({ authenticate, sessionMessage, forgotPasswordUrl }: LoginFormProps) {
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
      const errors = await authenticate(parsed.data);

      if (errors.email === 'Invalid credentials.') {
        setFormError('Email or password is incorrect.');
      } else if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
      }
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
      description="Sign in to continue to your workspace."
      layout="split"
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
      <form className="grid gap-4" noValidate onSubmit={(event) => void submit(event)}>
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
                className="pr-10"
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? 'text' : 'password'}
                value={password}
                {...controlProps}
              />
              <Button
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-1 top-1 size-8 text-muted-foreground hover:text-foreground"
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

        <div className="flex justify-end">
          {forgotPasswordUrl ? (
            <a className="text-sm font-medium text-primary hover:underline" href={forgotPasswordUrl}>
              Forgot password?
            </a>
          ) : (
            <Link className="text-sm font-medium text-primary hover:underline" to="/forgot-password">
              Forgot password?
            </Link>
          )}
        </div>

        <Button className="w-full" loading={isSubmitting} type="submit">
          Sign in
        </Button>
      </form>
    </AuthPageLayout>
  );
}
