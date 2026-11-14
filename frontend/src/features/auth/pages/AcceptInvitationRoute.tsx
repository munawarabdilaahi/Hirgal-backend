import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { AuthPageLayout } from '@/features/auth/components/AuthPageLayout';
import { getApiValidationErrors, getSafeErrorMessage } from '@/features/auth/auth-validation';
import { authApi } from '@/services/api/authApi';
import { setAccessToken } from '@/services/api/tokenStore';

export function AcceptInvitationRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const [token] = useState(() => new URLSearchParams(location.hash.slice(1)).get('token')
    ?? new URLSearchParams(location.search).get('token'));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (token && (location.hash || location.search)) {
      void navigate(location.pathname, { replace: true });
    }
  }, [location.hash, location.pathname, location.search, navigate, token]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || isSubmitting) return;

    const fields = new FormData(event.currentTarget);
    setFieldErrors({});
    setFormError(null);
    setIsSubmitting(true);

    try {
      const session = await authApi.acceptInvitation({
        token,
        name: String(fields.get('name')),
        password: String(fields.get('password')),
        password_confirmation: String(fields.get('password_confirmation')),
      });
      if (session.token_type !== 'Bearer' || !session.access_token) {
        throw new Error('The API returned an invalid authentication response.');
      }
      setAccessToken(session.access_token);
      void navigate('/dashboard', { replace: true });
    } catch (error: unknown) {
      const validationErrors = getApiValidationErrors(error);
      setFieldErrors(validationErrors);
      setFormError(validationErrors.token ?? validationErrors.email ?? getSafeErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthPageLayout
      title="Accept your invitation"
      description="Set up your Hirgal account."
      footer={<Link className="font-medium text-primary hover:underline" to="/login">Return to sign in</Link>}
    >
      <form className="grid gap-5" onSubmit={(event) => void submit(event)}>
        {!token && <Alert variant="warning">Open the link in your invitation email to continue.</Alert>}
        {formError && <Alert role="alert" variant="destructive">{formError}</Alert>}
        <FormField error={fieldErrors.name} htmlFor="invitation-name" label="Full name" required>
          {(props) => <Input {...props} name="name" autoComplete="name" required maxLength={255} />}
        </FormField>
        <FormField error={fieldErrors.password} htmlFor="invitation-password" label="Password" required>
          {(props) => <Input {...props} name="password" type="password" autoComplete="new-password" required minLength={8} />}
        </FormField>
        <FormField htmlFor="invitation-confirm-password" label="Confirm password" required>
          {(props) => <Input {...props} name="password_confirmation" type="password" autoComplete="new-password" required minLength={8} />}
        </FormField>
        <Button type="submit" disabled={!token} loading={isSubmitting}>Accept invitation</Button>
      </form>
    </AuthPageLayout>
  );
}
