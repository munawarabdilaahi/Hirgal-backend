import { useEffect, useState, type FormEvent } from 'react';
import { Check, Copy, KeyRound, LoaderCircle, RefreshCw, ShieldCheck, ShieldOff } from 'lucide-react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FormDialog, FormDialogActions } from '@/components/ui/form-dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { getApiValidationErrors, getSafeErrorMessage } from '@/features/auth/auth-validation';
import { accountApi } from '@/services/api/accountApi';
import type { ApiUser, TwoFactorSetup } from '@/services/api/contracts';
import { SettingsCard } from './shared';

type Stage = 'idle' | 'setup' | 'scan' | 'disable' | 'regenerate' | 'codes';

function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Copy failed. Select and copy the value manually.');
    }
  }
  return (
    <Button onClick={() => void copy()} size="sm" type="button" variant="outline">
      {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
      {copied ? 'Copied' : label}
    </Button>
  );
}

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  return (
    <div className="space-y-4">
      <Alert variant="warning">
        Store these recovery codes somewhere safe. Each code can be used once and they will not be shown again.
      </Alert>
      <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-4 font-mono text-sm">
        {codes.map((code) => <span key={code}>{code}</span>)}
      </div>
      <div className="flex flex-wrap gap-2">
        <CopyButton label="Copy all codes" value={codes.join('\n')} />
        <Button onClick={onDone} size="sm">I have saved my codes</Button>
      </div>
    </div>
  );
}

export function TwoFactorSettings({ user, onUserChanged }: { user: ApiUser; onUserChanged: (user: ApiUser) => void }) {
  const [stage, setStage] = useState<Stage>('idle');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();

  const enabled = Boolean(user.two_factor_enabled);

  useEffect(() => {
    if (!setup) {
      setQr(null);
      return;
    }
    let cancelled = false;
    void QRCode.toDataURL(setup.provisioning_uri, { errorCorrectionLevel: 'M', margin: 1, width: 240 })
      .then((url) => {
        if (!cancelled) {
          setQr(url);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('The QR code could not be generated. Use the manual setup key instead.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [setup]);

  function reset() {
    setStage('idle');
    setPassword('');
    setCode('');
    setSetup(null);
    setRecoveryCodes([]);
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

  async function startSetup(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    setError(undefined);
    try {
      const result = await accountApi.startTwoFactor(password);
      setSetup(result);
      setPassword('');
      setStage('scan');
    } catch (caught) {
      handleFailure(caught);
    } finally {
      setPending(false);
    }
  }

  async function confirm(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    setError(undefined);
    try {
      const result = await accountApi.confirmTwoFactor(code.trim());
      setRecoveryCodes(result.recovery_codes);
      setCode('');
      setStage('codes');
      onUserChanged({ ...user, two_factor_enabled: true, recovery_codes_remaining: result.recovery_codes.length });
    } catch (caught) {
      handleFailure(caught);
    } finally {
      setPending(false);
    }
  }

  async function disable(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    setError(undefined);
    try {
      await accountApi.disableTwoFactor(code.trim(), password);
      onUserChanged({ ...user, two_factor_enabled: false, recovery_codes_remaining: 0 });
      toast.success('Two-factor authentication disabled.');
      reset();
    } catch (caught) {
      handleFailure(caught);
    } finally {
      setPending(false);
    }
  }

  async function regenerate(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    setError(undefined);
    try {
      const result = await accountApi.regenerateRecoveryCodes(code.trim(), password);
      setRecoveryCodes(result.recovery_codes);
      onUserChanged({ ...user, recovery_codes_remaining: result.recovery_codes.length });
      setCode('');
      setPassword('');
      setStage('codes');
      toast.success('New recovery codes generated.');
    } catch (caught) {
      handleFailure(caught);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <SettingsCard
        description="Require a code from an authenticator app in addition to your password when signing in."
        title="Two-factor authentication"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`rounded-lg p-2 ${enabled ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
              {enabled ? <ShieldCheck aria-hidden="true" className="size-5" /> : <ShieldOff aria-hidden="true" className="size-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium">Authenticator app</p>
                <Badge variant={enabled ? 'success' : 'outline'}>{enabled ? 'Enabled' : 'Disabled'}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {enabled
                  ? `Recovery codes remaining: ${user.recovery_codes_remaining ?? 0} of 8.`
                  : 'Protect your account with time-based one-time codes from Google Authenticator, 1Password, Authy, or a similar app.'}
              </p>
            </div>
          </div>
          {enabled ? (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setStage('regenerate')} size="sm" variant="outline">
                <RefreshCw aria-hidden="true" className="size-4" /> Regenerate codes
              </Button>
              <Button onClick={() => setStage('disable')} size="sm" variant="outline">
                Disable
              </Button>
            </div>
          ) : (
            <Button onClick={() => setStage('setup')} size="sm">
              <KeyRound aria-hidden="true" className="size-4" /> Enable two-factor
            </Button>
          )}
        </div>
      </SettingsCard>

      {stage === 'setup' ? (
        <FormDialog
          description="Confirm your password to begin authenticator setup."
          onClose={reset}
          pending={pending}
          title="Enable two-factor authentication"
        >
          <form className="space-y-4" onSubmit={(event) => void startSetup(event)}>
            {error ? <Alert variant="destructive">{error}</Alert> : null}
            <FormField htmlFor="two-factor-password" label="Current password" error={errors.current_password} required>
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
            <FormDialogActions pending={pending} submitLabel="Continue" />
          </form>
        </FormDialog>
      ) : null}

      {stage === 'scan' && setup ? (
        <FormDialog
          description="Scan the QR code, then enter the six-digit code shown in your app."
          onClose={reset}
          pending={pending}
          title="Scan the QR code"
          wide
        >
          <form className="space-y-4" onSubmit={(event) => void confirm(event)}>
            {error ? <Alert variant="destructive">{error}</Alert> : null}
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <div className="grid size-[15rem] shrink-0 place-items-center rounded-lg border bg-white p-3">
                {qr ? (
                  <img alt="Authenticator app QR code" className="size-full" src={qr} />
                ) : (
                  <LoaderCircle aria-hidden="true" className="size-6 animate-spin text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <p className="text-sm leading-6 text-muted-foreground">
                  Cannot scan? Enter this setup key in your authenticator app, then use the generated six-digit code below.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="min-w-0 break-all rounded bg-muted px-2 py-1 font-mono text-sm">{setup.secret}</code>
                  <CopyButton label="Copy key" value={setup.secret} />
                </div>
                <FormField htmlFor="two-factor-confirm-code" label="Six-digit code" error={errors.code} required>
                  {(control) => (
                    <Input
                      {...control}
                      autoComplete="one-time-code"
                      inputMode="numeric"
                      maxLength={7}
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                    />
                  )}
                </FormField>
              </div>
            </div>
            <FormDialogActions pending={pending} submitLabel="Verify and enable" />
          </form>
        </FormDialog>
      ) : null}

      {stage === 'disable' ? (
        <FormDialog
          description="Enter your current password and a code from your authenticator app to turn off two-factor authentication."
          onClose={reset}
          pending={pending}
          title="Disable two-factor authentication"
        >
          <form className="space-y-4" onSubmit={(event) => void disable(event)}>
            {error ? <Alert variant="destructive">{error}</Alert> : null}
            <FormField htmlFor="two-factor-disable-code" label="Authentication code" error={errors.code} required>
              {(control) => (
                <Input
                  {...control}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  autoFocus
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                />
              )}
            </FormField>
            <FormField htmlFor="two-factor-disable-password" label="Current password" error={errors.current_password} required>
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
            <FormDialogActions pending={pending} submitLabel="Disable" />
          </form>
        </FormDialog>
      ) : null}

      {stage === 'regenerate' ? (
        <FormDialog
          description="Generate a new set of one-time recovery codes. Your existing codes will stop working."
          onClose={reset}
          pending={pending}
          title="Regenerate recovery codes"
        >
          <form className="space-y-4" onSubmit={(event) => void regenerate(event)}>
            {error ? <Alert variant="destructive">{error}</Alert> : null}
            <FormField htmlFor="two-factor-regen-code" label="Authentication code" error={errors.code} required>
              {(control) => (
                <Input
                  {...control}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  autoFocus
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                />
              )}
            </FormField>
            <FormField htmlFor="two-factor-regen-password" label="Current password" error={errors.current_password} required>
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
            <FormDialogActions pending={pending} submitLabel="Generate new codes" />
          </form>
        </FormDialog>
      ) : null}

      {stage === 'codes' && recoveryCodes.length ? (
        <FormDialog
          description="Save these recovery codes before continuing."
          onClose={reset}
          title="Recovery codes"
          wide
        >
          <RecoveryCodes codes={recoveryCodes} onDone={reset} />
        </FormDialog>
      ) : null}
    </>
  );
}
