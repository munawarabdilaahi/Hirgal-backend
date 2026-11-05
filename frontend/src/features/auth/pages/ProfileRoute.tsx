import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/features/auth/auth-hooks';
import { getApiValidationErrors, getSafeErrorMessage } from '@/features/auth/auth-validation';
import { authApi, authQueryKey } from '@/services/api/authApi';
import type { UpdateProfileRequest } from '@/services/api/contracts';

interface ProfileFormValues {
  name: string;
  timezone: string;
  phone: string;
  job_title: string;
  department: string;
  bio: string;
}

export function ProfileRoute() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<ProfileFormValues>(() => ({
    name: user?.name ?? '',
    timezone: user?.timezone ?? '',
    phone: user?.profile?.phone ?? '',
    job_title: user?.profile?.job_title ?? '',
    department: user?.profile?.department ?? '',
    bio: user?.profile?.bio ?? '',
  }));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!user) {
    return null;
  }

  const updateValue = (field: keyof ProfileFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);

    if (!values.name.trim()) {
      setFieldErrors({ name: 'Enter your name.' });
      return;
    }

    const request: UpdateProfileRequest = {
      name: values.name.trim(),
      timezone: values.timezone.trim() || null,
      phone: values.phone.trim() || null,
      job_title: values.job_title.trim() || null,
      department: values.department.trim() || null,
      bio: values.bio.trim() || null,
    };

    setIsSubmitting(true);

    try {
      const updatedUser = await authApi.updateProfile(request);
      queryClient.setQueryData(authQueryKey, updatedUser);
      setValues({
        name: updatedUser.name,
        timezone: updatedUser.timezone,
        phone: updatedUser.profile?.phone ?? '',
        job_title: updatedUser.profile?.job_title ?? '',
        department: updatedUser.profile?.department ?? '',
        bio: updatedUser.profile?.bio ?? '',
      });
      toast.success('Your profile has been updated.');
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
        <p className="text-sm font-medium text-muted-foreground">Your account</p>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Manage the profile details supported by your Hirgal account.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Personal details</CardTitle>
          <CardDescription>
            Your email address and account status are managed by your administrator.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {formError ? (
            <Alert className="mb-5" role="alert" variant="destructive">{formError}</Alert>
          ) : null}
          <form className="grid gap-5 sm:grid-cols-2" noValidate onSubmit={(event) => void submit(event)}>
            <FormField error={fieldErrors.name} htmlFor="profile-name" label="Name" required>
              {(controlProps) => (
                <Input
                  autoComplete="name"
                  onChange={(event) => updateValue('name', event.target.value)}
                  value={values.name}
                  {...controlProps}
                />
              )}
            </FormField>
            <FormField htmlFor="profile-email" label="Email address">
              {() => <Input autoComplete="email" disabled value={user.email} />}
            </FormField>
            <FormField
              error={fieldErrors.timezone}
              htmlFor="profile-timezone"
              label="Time zone"
              description="Use an IANA time zone, such as America/New_York."
            >
              {(controlProps) => (
                <Input
                  onChange={(event) => updateValue('timezone', event.target.value)}
                  placeholder="UTC"
                  value={values.timezone}
                  {...controlProps}
                />
              )}
            </FormField>
            <FormField error={fieldErrors.phone} htmlFor="profile-phone" label="Phone">
              {(controlProps) => (
                <Input
                  autoComplete="tel"
                  onChange={(event) => updateValue('phone', event.target.value)}
                  value={values.phone}
                  {...controlProps}
                />
              )}
            </FormField>
            <FormField error={fieldErrors.job_title} htmlFor="profile-job-title" label="Job title">
              {(controlProps) => (
                <Input
                  onChange={(event) => updateValue('job_title', event.target.value)}
                  value={values.job_title}
                  {...controlProps}
                />
              )}
            </FormField>
            <FormField error={fieldErrors.department} htmlFor="profile-department" label="Department">
              {(controlProps) => (
                <Input
                  onChange={(event) => updateValue('department', event.target.value)}
                  value={values.department}
                  {...controlProps}
                />
              )}
            </FormField>
            <FormField
              className="sm:col-span-2"
              error={fieldErrors.bio}
              htmlFor="profile-bio"
              label="About"
            >
              {(controlProps) => (
                <Textarea
                  maxLength={1000}
                  onChange={(event) => updateValue('bio', event.target.value)}
                  value={values.bio}
                  {...controlProps}
                />
              )}
            </FormField>
            <div className="flex justify-end sm:col-span-2">
              <Button loading={isSubmitting} type="submit">Save changes</Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Password &amp; security</CardTitle>
          <CardDescription>
            Change your password or revoke active sessions on other devices.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <a href="/change-password">Change password</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
