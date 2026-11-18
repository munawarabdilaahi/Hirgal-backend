import { useState, type FormEvent } from 'react';
import { Download, ShieldOff, Trash2, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormDialog, FormDialogActions } from '@/components/ui/form-dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { getApiValidationErrors, getSafeErrorMessage } from '@/features/auth/auth-validation';
import { accountApi } from '@/services/api/accountApi';
import { PasswordAction, SettingsCard } from './shared';

type Dialog = 'export' | 'deactivate' | 'delete' | null;

export function PrivacySection({ onSignedOut }: { onSignedOut: () => void }) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();

  function close() {
    setDialog(null);
    setPassword('');
    setConfirmation('');
    setErrors({});
    setError(undefined);
  }

  function handleFailure(caught: unknown) {
    const validation = getApiValidationErrors(caught);
    setErrors(validation);
    if (!Object.keys(validation).length) {
      setError(getSafeErrorMessage(caught));
    }
  }

  async function exportData(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    setError(undefined);
    try {
      const data = await accountApi.export(password);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `hirgal-account-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('Account data exported.');
      close();
    } catch (caught) {
      handleFailure(caught);
    } finally {
      setPending(false);
    }
  }

  async function deleteAccount(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    setError(undefined);
    try {
      await accountApi.deleteAccount(password, confirmation);
      toast.success('Your account has been deleted.');
      close();
      onSignedOut();
    } catch (caught) {
      handleFailure(caught);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="space-y-6">
        <SettingsCard
          description="Download a JSON copy of your profile, roles, and account metadata."
          title="Export your data"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-muted p-2 text-muted-foreground">
                <Download aria-hidden="true" className="size-5" />
              </div>
              <div>
                <p className="font-medium">Account data</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  The export excludes passwords, two-factor secrets, and authentication tokens.
                </p>
              </div>
            </div>
            <Button onClick={() => setDialog('export')} size="sm" variant="outline">Request export</Button>
          </div>
        </SettingsCard>

        <SettingsCard
          description="Temporarily disable your account and sign out everywhere. Contact an administrator to reactivate it."
          title="Deactivate account"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-warning/10 p-2 text-warning">
                <ShieldOff aria-hidden="true" className="size-5" />
              </div>
              <div>
                <p className="font-medium">Deactivate</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your data is preserved. You will be signed out of all devices immediately.
                </p>
              </div>
            </div>
            <Button onClick={() => setDialog('deactivate')} size="sm" variant="outline">
              <UserX aria-hidden="true" className="size-4" /> Deactivate account
            </Button>
          </div>
        </SettingsCard>

        <SettingsCard
          description="Permanently delete your account. This action is subject to ownership safeguards and cannot be undone by you."
          title="Delete account"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-destructive/10 p-2 text-destructive">
                <Trash2 aria-hidden="true" className="size-5" />
              </div>
              <div>
                <p className="font-medium">Delete account</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  If you are the last administrator or own shared projects, deletion will be blocked.
                </p>
              </div>
            </div>
            <Button onClick={() => setDialog('delete')} size="sm" variant="destructive">
              <Trash2 aria-hidden="true" className="size-4" /> Delete account
            </Button>
          </div>
        </SettingsCard>
      </div>

      {dialog === 'export' ? (
        <FormDialog
          description="Confirm your password to download a copy of your account data."
          onClose={close}
          pending={pending}
          title="Export account data"
        >
          <form className="space-y-4" onSubmit={(event) => void exportData(event)}>
            {error ? <Alert variant="destructive">{error}</Alert> : null}
            <FormField htmlFor="export-password" label="Current password" error={errors.current_password} required>
              {(control) => (
                <Input
                  {...control}
                  type="password"
                  autoComplete="current-password"
                  autoFocus
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              )}
            </FormField>
            <FormDialogActions pending={pending} submitLabel="Download export" />
          </form>
        </FormDialog>
      ) : null}

      {dialog === 'deactivate' ? (
        <PasswordAction
          action="Deactivate account"
          description="Confirm your password to deactivate your account and sign out everywhere."
          execute={async (current) => {
            await accountApi.deactivate(current);
            onSignedOut();
          }}
          onClose={close}
          title="Deactivate account"
        />
      ) : null}

      {dialog === 'delete' ? (
        <FormDialog
          description="This permanently deletes your account. Type DELETE to confirm."
          onClose={close}
          pending={pending}
          title="Delete account"
        >
          <form className="space-y-4" onSubmit={(event) => void deleteAccount(event)}>
            {error ? <Alert variant="destructive">{error}</Alert> : null}
            <Alert variant="warning">
              Projects and teams you lead must be transferred before your account can be deleted.
            </Alert>
            <FormField
              description="Type DELETE in capital letters."
              error={errors.confirm}
              htmlFor="delete-confirm"
              label="Confirmation"
              required
            >
              {(control) => (
                <Input
                  {...control}
                  autoComplete="off"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
              )}
            </FormField>
            <FormField htmlFor="delete-password" label="Current password" error={errors.current_password} required>
              {(control) => (
                <Input
                  {...control}
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              )}
            </FormField>
            <FormDialogActions
              pending={pending}
              submitDisabled={confirmation !== 'DELETE'}
              submitLabel="Delete my account"
            />
          </form>
        </FormDialog>
      ) : null}
    </>
  );
}
