import { LoadingState } from '@/components/feedback/LoadingState';
import { NativeSelect } from '@/components/ui/native-select';
import { useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormDialog, FormDialogActions } from '@/components/ui/form-dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { getApiValidationErrors, getSafeErrorMessage } from '@/features/auth/auth-validation';
import { apiClient } from '@/services/api/apiClient';
import type { ApiSuccess } from '@/services/api/contracts';

type InvitationRole = { id: number; name: string; slug: string };

export function InviteUserDialog() {
  const [open, setOpen] = useState(false);
  const roles = useQuery({
    queryKey: ['users', 'invitation-roles'],
    queryFn: async () => (await apiClient.get<ApiSuccess<InvitationRole[]>>('/invitations/roles')).data.data,
    enabled: open,
    staleTime: 0,
  });
  const invite = useMutation({
    mutationFn: ({ email, role_id }: { email: string; role_id: number }) =>
      apiClient.post('/invitations', { email, role_id }),
    onSuccess: (_, { email }) => {
      setOpen(false);
      toast.success(`Invitation created for ${email}.`);
    },
  });
  const errors = getApiValidationErrors(invite.error);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (invite.isPending || !roles.data?.length) return;

    const fields = new FormData(event.currentTarget);
    invite.mutate({
      email: String(fields.get('email')).trim(),
      role_id: Number(fields.get('role_id')),
    });
  }

  return (
    <>
      <Button onClick={() => { invite.reset(); setOpen(true); }}><Plus aria-hidden="true" /> Invite user</Button>
      {open && <FormDialog title="Invite user" description="Send an email link so the new user can set their own password." pending={invite.isPending} onClose={() => setOpen(false)}>
        <form className="grid gap-4" onSubmit={submit}>
          {invite.isError && Object.keys(errors).length === 0 && (
            <Alert role="alert" variant="destructive">{getSafeErrorMessage(invite.error)}</Alert>
          )}
          <FormField label="Email address" htmlFor="invite-email" error={errors.email} required>
            {(props) => <Input {...props} name="email" type="email" autoComplete="email" maxLength={255} required disabled={invite.isPending} />}
          </FormField>
          <FormField label="System role" htmlFor="invite-role" error={errors.role_id} required>
            {(props) => roles.isPending ? <LoadingState label="Loading roles" layout="control" /> : (
              <NativeSelect {...props} name="role_id" required disabled={roles.isPending || roles.isError || invite.isPending}>
                <option value="">Choose a role</option>
                {roles.data?.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
              </NativeSelect>
            )}
          </FormField>
          {roles.isError && <Button type="button" variant="outline" onClick={() => void roles.refetch()}>Retry loading roles</Button>}
          {roles.data?.length === 0 && <p role="status">No roles are available for invitations.</p>}
          <FormDialogActions pending={invite.isPending} submitDisabled={roles.isError || !roles.data?.length} submitLabel="Send invitation" />
        </form>
      </FormDialog>}
    </>
  );
}
