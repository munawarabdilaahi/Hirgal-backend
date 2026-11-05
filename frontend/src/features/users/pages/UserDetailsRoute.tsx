import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { UserIdentity } from '@/components/ui/user-identity';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AccountStatusBadge } from '@/features/auth/components/AccountStatusBadge';
import { authQueryKey } from '@/services/api/authApi';
import { ApiError } from '@/services/api/ApiError';
import { getApiValidationErrors } from '@/features/auth/auth-validation';
import { useAuth } from '@/features/auth/auth-hooks';
import { hasGlobalRole, hasPermission } from '@/features/auth/permissions';
import { userApi } from '@/services/api/userApi';
import { userQueryKeys, useUserDetails } from '@/features/users/user-queries';
import type { ApiUser, UpdateUserRequest } from '@/services/api/contracts';
import { z } from 'zod';
import { useForm } from 'react-hook-form';

const editableUserSchema = z.object({
  name: z.string().trim().min(1, 'Enter the user’s name.').max(255),
  email: z.string().trim().email('Enter a valid email address.').max(255),
  timezone: z.string().trim(),
});

type EditableUserFields = z.infer<typeof editableUserSchema>;
type AccountAction = 'activate' | 'deactivate';

function detailsErrorDescription(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 403) {
      return 'Your account is not allowed to view this user. Administrative details are restricted.';
    }

    if (error.status === 404) {
      return 'This user no longer exists or is outside your access scope.';
    }

    if (error.status === 500) {
      return 'The server could not load this user right now. Try again shortly.';
    }
  }

  return 'Hirgal could not load this user. Check your connection and try again.';
}

function mutationErrorDescription(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 403) {
      return 'The server denied this change. Check your access and the user account’s eligibility.';
    }

    if (error.status === 404) {
      return 'This user is no longer available. Return to the user list and refresh it.';
    }

    if (error.status === 422) {
      return 'Some user details were rejected. Review the highlighted fields.';
    }

    if (error.status === 500) {
      return 'The server could not save this change. Try again shortly.';
    }
  }

  return 'Hirgal could not save this change. Check your connection and try again.';
}

export function UserDetailsRoute() {
  const { userId: userIdParam } = useParams();
  const userId = Number(userIdParam);
  const auth = useAuth();
  const queryClient = useQueryClient();
  const userQuery = useUserDetails(userId);
  const person = userQuery.data;
  const canUpdateUsers = hasPermission(auth.user, 'users.update');
  const canDeactivateUsers = hasPermission(auth.user, 'users.delete');
  const actorIsSystemAdmin = hasGlobalRole(auth.user, 'system-admin');
  const [accountAction, setAccountAction] = useState<AccountAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setError,
  } = useForm<EditableUserFields>({
    defaultValues: { name: '', email: '', timezone: '' },
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (person) {
      reset({ name: person.name, email: person.email, timezone: person.timezone ?? '' });
    }
  }, [person, reset]);

  const updateMutation = useMutation({
    mutationFn: (request: UpdateUserRequest) => userApi.updateUser(userId, request),
    onSuccess: (updatedUser) => {
      applyUpdatedUser(queryClient, updatedUser, auth.user?.id);
      setFormError(null);
      setServerFieldErrors({});
      toast.success('User details updated.');
    },
    onError: (error: unknown) => {
      setFormError(mutationErrorDescription(error));
      setServerFieldErrors(getApiValidationErrors(error));
      if (error instanceof ApiError && typeof error.errors === 'object' && error.errors !== null) {
        const apiErrors = getApiValidationErrors(error);
        for (const field of ['name', 'email', 'timezone'] as const) {
          if (apiErrors[field]) {
            setError(field, { message: apiErrors[field], type: 'server' });
          }
        }
      }
    },
  });

  const accountMutation = useMutation({
    mutationFn: (action: AccountAction) =>
      action === 'activate' ? userApi.activateUser(userId) : userApi.deactivateUser(userId),
    onSuccess: (updatedUser, action) => {
      applyUpdatedUser(queryClient, updatedUser, auth.user?.id);
      setActionError(null);
      setAccountAction(null);
      toast.success(action === 'activate' ? 'User account activated.' : 'User account suspended.');
    },
    onError: (error: unknown) => setActionError(mutationErrorDescription(error)),
  });

  if (!Number.isInteger(userId) || userId < 1) {
    return (
      <ErrorState
        description="The user ID in this address is invalid. Return to the user list and choose a user."
        title="Invalid user address"
      />
    );
  }

  if (userQuery.isPending) {
    return (
      <div className="flex min-h-48 items-center justify-center">
        <LoadingState label="Loading user details" />
      </div>
    );
  }

  if (userQuery.isError || !person) {
    return (
      <ErrorState
        action={
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline"><Link to="/users">Back to users</Link></Button>
            <Button onClick={() => void userQuery.refetch()} variant="outline">Retry</Button>
          </div>
        }
        description={detailsErrorDescription(userQuery.error)}
        title="User details unavailable"
      />
    );
  }

  const isSelf = auth.user?.id === person.id;
  const canChangeAccountStatus = !isSelf && (
    person.account_status === 'active'
      ? canDeactivateUsers && (!isSystemAdmin(person) || actorIsSystemAdmin)
      : hasPermission(auth.user, 'users.update') && (!isSystemAdmin(person) || actorIsSystemAdmin)
  );
  const nextAction: AccountAction = person.account_status === 'active' ? 'deactivate' : 'activate';
  const isAdminTarget = isSystemAdmin(person);
  const canEditUser = canUpdateUsers && (!isAdminTarget || actorIsSystemAdmin);

  const submitUserUpdate = (values: EditableUserFields) => {
    setFormError(null);
    setServerFieldErrors({});
    const parsed = editableUserSchema.safeParse(values);

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === 'name' || field === 'email' || field === 'timezone') {
          setError(field, { message: issue.message, type: 'validation' });
        }
      }
      return;
    }

    const request: UpdateUserRequest = {
      name: parsed.data.name,
      email: parsed.data.email,
      timezone: parsed.data.timezone || null,
    };
    updateMutation.mutate(request);
  };

  const beginAccountAction = (action: AccountAction) => {
    setActionError(null);
    setAccountAction(action);
  };

  const confirmAccountAction = () => {
    if (accountAction && !accountMutation.isPending) {
      accountMutation.mutate(accountAction);
    }
  };

  return (
    <section aria-labelledby="user-details-title" className="mx-auto max-w-5xl space-y-6">
      <Button asChild className="-ml-2" variant="ghost">
        <Link to="/users">
          <ArrowLeft aria-hidden="true" />
          Back to users
        </Link>
      </Button>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-3">
          <p className="text-sm font-medium text-primary">User administration</p>
          <h1 className="sr-only" id="user-details-title">User details for {person.name}</h1>
          <UserIdentity
            className="items-start"
            detail={person.email}
            imageUrl={person.avatar_url}
            name={person.name}
          />
        </div>
        <AccountStatusBadge status={person.account_status} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Account details</CardTitle>
            <CardDescription>
              Global role and account fields returned by the administrative user resource.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-5 sm:grid-cols-2">
              <DetailValue label="Email verification" value={person.email_verified_at ? 'Verified' : 'Not verified'} />
              <DetailValue label="Last sign-in" value={formatDate(person.last_login_at)} />
              <DetailValue label="Time zone" value={person.timezone || 'UTC'} />
              <DetailValue label="Account created" value={formatDate(person.created_at)} />
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Global roles</dt>
                <dd className="mt-2 flex flex-wrap gap-2">
                  {person.roles?.length ? person.roles.map((role) => (
                    <span className="rounded-md border px-2.5 py-1 text-sm" key={role.id}>
                      {role.name}
                    </span>
                  )) : <span className="text-sm text-muted-foreground">No global role assigned</span>}
                </dd>
              </div>
              <DetailValue label="Job title" value={person.profile?.job_title || 'Not provided'} />
              <DetailValue label="Department" value={person.profile?.department || 'Not provided'} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account access</CardTitle>
            <CardDescription>
              {isSelf
                ? 'Use your profile and security settings to manage your own account.'
                : 'Account status changes require permission and are confirmed before submission.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {canChangeAccountStatus ? (
              <>
                <p className="text-sm text-muted-foreground">
                  {nextAction === 'deactivate'
                    ? 'Suspending this account revokes the user’s active Sanctum tokens.'
                    : 'Activating this account restores access with its current global role.'}
                </p>
                <Button
                  className="w-full"
                  onClick={() => beginAccountAction(nextAction)}
                  variant={nextAction === 'deactivate' ? 'destructive' : 'default'}
                >
                  {nextAction === 'deactivate' ? 'Suspend account' : 'Activate account'}
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {isSelf
                  ? 'You cannot change your own account status here.'
                  : 'You do not have permission to change this account’s status.'}
              </p>
            )}
            {isAdminTarget ? (
              <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-muted-foreground">
                <p className="flex items-center gap-2 font-medium text-foreground">
                  <ShieldCheck aria-hidden="true" className="size-4" />
                  System administrator account
                </p>
                <p className="mt-1">
                  The backend protects the last active System Admin from being suspended. It also
                  restricts System Admin account changes to another System Admin.
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {canEditUser ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Edit user details</CardTitle>
              <CardDescription>
                Update the name, email, or time zone supported by the administrative endpoint. Global
                role assignment is unavailable because the backend has no role-list endpoint.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {formError ? (
                <p className="mb-5 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
                  {formError}
                </p>
              ) : null}
              <form className="grid gap-5 md:grid-cols-3" noValidate onSubmit={handleSubmit(submitUserUpdate)}>
                <FormField error={errors.name?.message ?? serverFieldErrors.name} htmlFor="user-name" label="Name" required>
                  {(controlProps) => <Input autoComplete="name" {...controlProps} {...register('name')} />}
                </FormField>
                <FormField error={errors.email?.message ?? serverFieldErrors.email} htmlFor="user-email" label="Email address" required>
                  {(controlProps) => <Input autoComplete="email" type="email" {...controlProps} {...register('email')} />}
                </FormField>
                <FormField
                  error={errors.timezone?.message ?? serverFieldErrors.timezone}
                  htmlFor="user-timezone"
                  label="Time zone"
                  description="Use a valid IANA time zone, such as Africa/Nairobi."
                >
                  {(controlProps) => <Input {...controlProps} {...register('timezone')} />}
                </FormField>
                <div className="flex justify-end md:col-span-3">
                  <Button loading={updateMutation.isPending} type="submit">
                    Save user details
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <AccountActionConfirmation
        action={accountAction}
        error={actionError}
        isPending={accountMutation.isPending}
        isSystemAdminTarget={isAdminTarget}
        onCancel={() => setAccountAction(null)}
        onConfirm={confirmAccountAction}
      />
    </section>
  );
}

function applyUpdatedUser(
  queryClient: ReturnType<typeof useQueryClient>,
  updatedUser: ApiUser,
  authenticatedUserId?: number,
): void {
  queryClient.setQueryData(userQueryKeys.detail(updatedUser.id), updatedUser);
  if (updatedUser.id === authenticatedUserId) {
    queryClient.setQueryData(authQueryKey, updatedUser);
  }
  void queryClient.invalidateQueries({ queryKey: userQueryKeys.lists() });
}

function DetailValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm">{value}</dd>
    </div>
  );
}

function formatDate(value?: string | null): string {
  if (!value) {
    return 'Not recorded';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Not recorded';
  }

  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function isSystemAdmin(user: ApiUser): boolean {
  return hasGlobalRole(user, 'system-admin');
}

function AccountActionConfirmation({
  action,
  error,
  isPending,
  isSystemAdminTarget,
  onCancel,
  onConfirm,
}: {
  action: AccountAction | null;
  error: string | null;
  isPending: boolean;
  isSystemAdminTarget: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isDeactivation = action === 'deactivate';

  return (
    <AlertDialog onOpenChange={(open) => { if (!open && !isPending) { onCancel(); } }} open={action !== null}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{isDeactivation ? 'Suspend this user account?' : 'Activate this user account?'}</AlertDialogTitle>
          <AlertDialogDescription>
            {isDeactivation
              ? 'The user will lose access immediately, and their active API tokens will be revoked.'
              : 'The user will regain access using their current global role.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {isDeactivation && isSystemAdminTarget ? (
          <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
            The backend will reject this operation if it would suspend the last active System Admin.
          </p>
        ) : null}
        {error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <Button disabled={isPending} onClick={onCancel} type="button" variant="outline">
            Cancel
          </Button>
          <Button
            loading={isPending}
            onClick={onConfirm}
            type="button"
            variant={isDeactivation ? 'destructive' : 'default'}
          >
            {isDeactivation ? 'Suspend account' : 'Activate account'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
