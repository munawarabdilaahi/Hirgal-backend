import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormDialog, FormDialogActions } from '@/components/ui/form-dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { getApiValidationErrors, getSafeErrorMessage } from '@/features/auth/auth-validation';
import { userApi } from '@/services/api/userApi';
import type { CreateUserRequest } from '@/services/api/contracts';
import { userQueryKeys } from './user-queries';

export function AddUserDialog() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const createUser = useMutation({
    mutationFn: (request: CreateUserRequest) => userApi.createUser(request),
    onSuccess: async () => {
      setOpen(false);
      toast.success('User created.');
      await queryClient.invalidateQueries({ queryKey: userQueryKeys.lists() });
    },
  });
  const errors = getApiValidationErrors(createUser.error);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (createUser.isPending) return;
    const fields = new FormData(event.currentTarget);
    createUser.mutate({
      name: String(fields.get('name')).trim(),
      email: String(fields.get('email')).trim(),
      password: String(fields.get('password')),
      password_confirmation: String(fields.get('password_confirmation')),
    });
  }

  return (
    <>
      <Button variant="outline" onClick={() => { createUser.reset(); setOpen(true); }}>
        <Plus aria-hidden="true" /> Add user
      </Button>
      {open && (
        <FormDialog title="Add user" description="Create an active Member account with an initial password." pending={createUser.isPending} onClose={() => setOpen(false)}>
          <form className="grid gap-4" onSubmit={submit}>
            {createUser.isError && Object.keys(errors).length === 0 && (
              <Alert role="alert" variant="destructive">{getSafeErrorMessage(createUser.error)}</Alert>
            )}
            <FormField label="Full name" htmlFor="new-user-name" error={errors.name} required>
              {(props) => <Input {...props} name="name" autoComplete="name" maxLength={255} required />}
            </FormField>
            <FormField label="Email address" htmlFor="new-user-email" error={errors.email} required>
              {(props) => <Input {...props} name="email" type="email" autoComplete="email" maxLength={255} required />}
            </FormField>
            <FormField label="Initial password" htmlFor="new-user-password" description="Use at least 8 characters." error={errors.password} required>
              {(props) => <Input {...props} name="password" type="password" autoComplete="new-password" minLength={8} required />}
            </FormField>
            <FormField label="Confirm password" htmlFor="new-user-password-confirmation" error={errors.password_confirmation} required>
              {(props) => <Input {...props} name="password_confirmation" type="password" autoComplete="new-password" minLength={8} required />}
            </FormField>
            <FormDialogActions pending={createUser.isPending} submitLabel="Create user" />
          </form>
        </FormDialog>
      )}
    </>
  );
}
