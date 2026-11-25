import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react';
import { ArrowLeft, KeyRound, RefreshCw } from 'lucide-react';
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
  recoveryCodeSchema,
  twoFactorCodeSchema,
} from '@/features/auth/auth-validation';
import { getSafeRedirectPath } from '@/features/auth/safeRedirect';
import { ApiError } from '@/services/api/ApiError';
import { cn } from '@/lib/utils';

const STORAGE_CHALLENGE_KEY = 'hirgal_2fa_challenge_token';

export function TwoFactorChallengeRoute() {
  const { verifyTwoFactor, cancelTwoFactor } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const challengeToken =
    (location.state as { challenge_token?: string } | null)?.challenge_token ??
    sessionStorage.getItem(STORAGE_CHALLENGE_KEY) ??
    '';

  useEffect(() => {
    if (challengeToken) {
      sessionStorage.setItem(STORAGE_CHALLENGE_KEY, challengeToken);
    } else {
      navigate('/login', { replace: true });
    }
  }, [challengeToken, navigate]);

  if (!challengeToken) {
    return null;
  }

  const handleVerify = async (data: { code?: string; recovery_code?: string }) => {
    await verifyTwoFactor({
      challenge_token: challengeToken,
      ...(data.code ? { code: data.code } : {}),
      ...(data.recovery_code ? { recovery_code: data.recovery_code } : {}),
    });
    sessionStorage.removeItem(STORAGE_CHALLENGE_KEY);
    navigate(getSafeRedirectPath((location.state as { from?: unknown } | null)?.from) ?? '/dashboard', {
      replace: true,
    });
  };

  const handleCancel = async () => {
    try {
      await cancelTwoFactor(challengeToken);
    } finally {
      sessionStorage.removeItem(STORAGE_CHALLENGE_KEY);
      navigate('/login', { replace: true });
    }
  };

  return (
    <TwoFactorChallengeForm
      challengeToken={challengeToken}
      onCancel={handleCancel}
      verify={handleVerify}
    />
  );
}

export interface TwoFactorChallengeFormProps {
  challengeToken: string;
  verify: (data: { code?: string; recovery_code?: string }) => Promise<void>;
  onCancel?: () => Promise<void> | void;
  sessionMessage?: string | null | undefined;
  loginUrl?: string;
}

export function TwoFactorChallengeForm({
  verify,
  onCancel,
  sessionMessage,
  loginUrl = '/login',
}: TwoFactorChallengeFormProps) {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [resendNotice, setResendNotice] = useState<string | null>(null);

  const digitRefs = useRef<(HTMLInputElement | null)[]>([]);
  const recoveryInputRef = useRef<HTMLInputElement>(null);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (isRecoveryMode) {
      recoveryInputRef.current?.focus();
    } else {
      digitRefs.current[0]?.focus();
    }
  }, [isRecoveryMode]);

  const handleDigitChange = (index: number, raw: string) => {
    setFormError(null);
    setResendNotice(null);
    if (fieldErrors.code) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.code;
        return next;
      });
    }

    // If pasted or multi-character input:
    const cleanDigits = raw.replace(/\D/g, '');
    if (cleanDigits.length > 1) {
      const next = [...digits];
      const slice = cleanDigits.slice(0, 6);
      for (let i = 0; i < slice.length; i++) {
        next[i] = slice[i] ?? '';
      }
      setDigits(next);
      const focusIndex = Math.min(slice.length, 5);
      digitRefs.current[focusIndex]?.focus();
      return;
    }

    const next = [...digits];
    next[index] = cleanDigits;
    setDigits(next);

    if (cleanDigits && index < 5) {
      digitRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      if (digits[index] === '' && index > 0) {
        event.preventDefault();
        const next = [...digits];
        next[index - 1] = '';
        setDigits(next);
        digitRefs.current[index - 1]?.focus();
      }
    } else if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      digitRefs.current[index - 1]?.focus();
    } else if (event.key === 'ArrowRight' && index < 5) {
      event.preventDefault();
      digitRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) {
      return;
    }

    const next = [...digits];
    for (let i = 0; i < 6; i++) {
      next[i] = pasted[i] || '';
    }
    setDigits(next);

    const focusIndex = Math.min(pasted.length, 5);
    digitRefs.current[focusIndex]?.focus();
  };

  const handleRecoveryCodeChange = (raw: string) => {
    setRecoveryCode(raw);
    setFormError(null);
    if (fieldErrors.recovery_code) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.recovery_code;
        return next;
      });
    }
  };

  const toggleMode = () => {
    setIsRecoveryMode((prev) => !prev);
    setFieldErrors({});
    setFormError(null);
    setResendNotice(null);
  };

  const handleResend = () => {
    if (cooldown > 0) {
      return;
    }

    setCooldown(30);
    setResendNotice('Check your authenticator app for the current six-digit code.');
    setDigits(['', '', '', '', '', '']);
    digitRefs.current[0]?.focus();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setResendNotice(null);

    if (isRecoveryMode) {
      const parsed = recoveryCodeSchema.safeParse({ recovery_code: recoveryCode });
      if (!parsed.success) {
        setFieldErrors({ recovery_code: 'Enter your recovery code.' });
        return;
      }

      setIsSubmitting(true);
      try {
        await verify({ recovery_code: parsed.data.recovery_code });
      } catch (error: unknown) {
        handleError(error);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      const codeString = digits.join('');
      const parsed = twoFactorCodeSchema.safeParse({ code: codeString });
      if (!parsed.success) {
        setFieldErrors({ code: 'Enter the six-digit code from your authenticator app.' });
        return;
      }

      setIsSubmitting(true);
      try {
        await verify({ code: parsed.data.code });
      } catch (error: unknown) {
        handleError(error);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleError = (error: unknown) => {
    const apiErrors = getApiValidationErrors(error);
    setFieldErrors(apiErrors);

    if (apiErrors.challenge) {
      setFormError(apiErrors.challenge);
    } else if (apiErrors.code) {
      setFieldErrors({ code: apiErrors.code });
      setFormError(apiErrors.code);
    } else if (apiErrors.recovery_code) {
      setFieldErrors({ recovery_code: apiErrors.recovery_code });
      setFormError(apiErrors.recovery_code);
    } else if (error instanceof ApiError && error.message) {
      setFormError(error.message);
    } else {
      setFormError(getSafeErrorMessage(error));
    }
  };

  const isFormEmpty = isRecoveryMode ? !recoveryCode.trim() : digits.join('').length < 6;

  return (
    <AuthPageLayout
      description={
        isRecoveryMode
          ? 'Enter your emergency recovery code to continue.'
          : 'Enter the verification code to continue.'
      }
      layout="split"
      title="Verify your identity"
    >
      {sessionMessage ? (
        <Alert className="mb-4" variant="warning">
          {sessionMessage}
        </Alert>
      ) : null}
      {resendNotice ? (
        <Alert className="mb-4" variant="default">
          {resendNotice}
        </Alert>
      ) : null}
      {formError ? (
        <Alert className="mb-4" role="alert" variant="destructive">
          {formError}
        </Alert>
      ) : null}

      <form className="grid gap-5" noValidate onSubmit={(event) => void submit(event)}>
        {!isRecoveryMode ? (
          <div className="space-y-2">
            <div
              aria-label="Six-digit verification code"
              className="flex items-center justify-between gap-1.5 sm:gap-2"
              role="group"
            >
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    digitRefs.current[index] = el;
                  }}
                  aria-invalid={Boolean(fieldErrors.code)}
                  aria-label={index === 0 ? 'Verification code, digit 1 of 6' : `Digit ${index + 1} of 6`}
                  autoComplete={index === 0 ? 'one-time-code' : 'off'}
                  autoFocus={index === 0}
                  className={cn(
                    'size-11 sm:size-12 rounded-xl border text-center font-mono text-xl font-semibold transition-all',
                    'bg-background text-foreground shadow-xs',
                    'focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20',
                    fieldErrors.code
                      ? 'border-destructive focus:border-destructive focus:ring-destructive/20'
                      : 'border-input',
                    isSubmitting && 'cursor-not-allowed opacity-50',
                  )}
                  disabled={isSubmitting}
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(e) => handleDigitChange(index, e.target.value)}
                  onKeyDown={(e) => handleDigitKeyDown(index, e)}
                  onPaste={handlePaste}
                  type="text"
                  value={digit}
                />
              ))}
            </div>
            {fieldErrors.code && !formError ? (
              <p className="text-xs text-destructive" role="alert">
                {fieldErrors.code}
              </p>
            ) : null}
          </div>
        ) : (
          <FormField
            error={fieldErrors.recovery_code}
            htmlFor="two-factor-recovery-code"
            label="Recovery code"
            required
          >
            {(controlProps) => (
              <div className="relative">
                <Input
                  autoComplete="off"
                  autoFocus
                  className="font-mono text-center text-lg uppercase tracking-wider"
                  onChange={(event) => handleRecoveryCodeChange(event.target.value)}
                  placeholder="ABCD-EFGH"
                  ref={recoveryInputRef}
                  type="text"
                  value={recoveryCode}
                  {...controlProps}
                />
                <KeyRound
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
                />
              </div>
            )}
          </FormField>
        )}

        <div className="flex flex-col gap-2.5">
          <Button
            className="w-full"
            disabled={isSubmitting || isFormEmpty}
            loading={isSubmitting}
            type="submit"
          >
            Verify
          </Button>

          {!isRecoveryMode ? (
            <div className="flex items-center justify-between text-xs">
              <button
                className={cn(
                  'inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground transition-colors',
                  cooldown > 0 && 'cursor-not-allowed opacity-60 hover:text-muted-foreground',
                )}
                disabled={cooldown > 0}
                onClick={handleResend}
                type="button"
              >
                <RefreshCw aria-hidden="true" className={cn('size-3.5', cooldown > 0 && 'animate-spin')} />
                {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
              </button>

              <button
                className="font-medium text-primary hover:underline"
                onClick={toggleMode}
                type="button"
              >
                Use a recovery code
              </button>
            </div>
          ) : (
            <div className="flex justify-center text-xs">
              <button
                className="font-medium text-primary hover:underline"
                onClick={toggleMode}
                type="button"
              >
                Use verification code
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center pt-2">
          {onCancel ? (
            <button
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:underline"
              onClick={() => void onCancel()}
              type="button"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              Back to sign in
            </button>
          ) : (
            <Link
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:underline"
              to={loginUrl}
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              Back to sign in
            </Link>
          )}
        </div>
      </form>
    </AuthPageLayout>
  );
}
