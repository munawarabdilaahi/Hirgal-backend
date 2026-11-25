import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/app/providers/useTheme';
import type { ThemePreference } from '@/app/providers/theme-context';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getSafeErrorMessage } from '@/features/auth/auth-validation';
import type { ApiUser, ApiUserProfile, UpdateProfileRequest } from '@/services/api/contracts';
import { SettingsCard } from './shared';

const timezones = [
  'UTC',
  'Africa/Nairobi',
  'Africa/Mogadishu',
  'Africa/Addis_Ababa',
  'Africa/Djibouti',
  'Africa/Kampala',
  'Africa/Dar_es_Salaam',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Asia/Dubai',
  'Asia/Riyadh',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Australia/Sydney',
];

const dateFormats = [
  { value: 'Y-m-d', label: '2026-11-17' },
  { value: 'd/m/Y', label: '17/11/2026' },
  { value: 'm/d/Y', label: '11/17/2026' },
];

const timeFormats = [
  { value: '24h', label: '24-hour (14:30)' },
  { value: '12h', label: '12-hour (2:30 PM)' },
];

function SelectField({
  id,
  label,
  description,
  value,
  onChange,
  children,
  disabled,
}: {
  id: string;
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select disabled={disabled} onValueChange={onChange} value={value}>
        <SelectTrigger id={id}><SelectValue /></SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
      <p className="text-sm leading-5 text-muted-foreground">{description}</p>
    </div>
  );
}

export function PreferencesSection({
  user,
  profile,
  save,
}: {
  user: ApiUser;
  profile: ApiUserProfile | null;
  save: (payload: UpdateProfileRequest) => Promise<void>;
}) {
  const { preference: theme, setPreference: setTheme } = useTheme();
  const [timezone, setTimezone] = useState(user.timezone ?? 'UTC');
  const [locale] = useState('en');
  const [dateFormat, setDateFormat] = useState<'Y-m-d' | 'd/m/Y' | 'm/d/Y'>(profile?.date_format === 'd/m/Y' || profile?.date_format === 'm/d/Y' ? profile.date_format : 'Y-m-d');
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>(profile?.time_format === '12h' ? '12h' : '24h');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    setTimezone(user.timezone ?? 'UTC');
  }, [user.timezone]);

  useEffect(() => {
    setDateFormat(profile?.date_format === 'd/m/Y' || profile?.date_format === 'm/d/Y' ? profile.date_format : 'Y-m-d');
    setTimeFormat(profile?.time_format === '12h' ? '12h' : '24h');
  }, [profile?.date_format, profile?.time_format]);

  const dirty = timezone !== (user.timezone ?? 'UTC')
    || dateFormat !== (profile?.date_format ?? 'Y-m-d')
    || timeFormat !== (profile?.time_format ?? '24h')
    || theme !== (profile?.theme_preference ?? 'system');

  async function submit() {
    setPending(true);
    setError(undefined);
    try {
      await save({ timezone, locale: 'en', date_format: dateFormat, time_format: timeFormat, theme_preference: theme });
      toast.success('Preferences saved.');
    } catch (caught) {
      setError(getSafeErrorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <SettingsCard
      description="Control how dates, times, and language are displayed across Hirgal."
      footer={
        <div className="flex justify-end">
          <Button disabled={!dirty || pending} loading={pending} onClick={() => void submit()} size="sm">
            Save preferences
          </Button>
        </div>
      }
      title="Preferences and appearance"
    >
      <div className="grid gap-5">
        {error ? <Alert variant="destructive">{error}</Alert> : null}
        <SelectField
          description="Applied immediately on this device and saved to your account preference."
          id="account-theme"
          label="Appearance"
          onChange={(value) => setTheme(value as ThemePreference)}
          value={theme}
        >
          <SelectItem value="system">System</SelectItem>
          <SelectItem value="light">Light</SelectItem>
          <SelectItem value="dark">Dark</SelectItem>
        </SelectField>
        <SelectField
          description="Hirgal currently ships with English. Additional languages will appear here when translations are available."
          id="account-language"
          label="Language"
          onChange={() => undefined}
          value={locale}
          disabled
        >
          <SelectItem value="en">English</SelectItem>
        </SelectField>
        <SelectField
          description="Used for dates in tables, activity, and exports."
          id="account-date-format"
          label="Date format"
          onChange={(value) => setDateFormat(value === 'd/m/Y' || value === 'm/d/Y' ? value : 'Y-m-d')}
          value={dateFormat}
        >
          {dateFormats.map((option) => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectField>
        <SelectField
          description="Used for timestamps and due-time display."
          id="account-time-format"
          label="Time format"
          onChange={(value) => setTimeFormat(value === '12h' ? '12h' : '24h')}
          value={timeFormat}
        >
          {timeFormats.map((option) => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectField>
        <SelectField
          description="Dates and times are shown in this timezone."
          id="account-timezone"
          label="Timezone"
          onChange={setTimezone}
          value={timezone}
        >
          {timezones.map((zone) => (
            <SelectItem key={zone} value={zone}>{zone.replace(/_/g, ' ')}</SelectItem>
          ))}
        </SelectField>
        <div className="rounded-lg border bg-muted/40 p-4 text-sm">
          <p className="font-medium">Preview</p>
          <p className="mt-1 text-muted-foreground">
            {timeFormat === '12h' ? 'Today at 2:30 PM' : 'Today at 14:30'} ·{' '}
            {dateFormat === 'd/m/Y' ? '17/11/2026' : dateFormat === 'm/d/Y' ? '11/17/2026' : '2026-11-17'}
          </p>
        </div>
      </div>
    </SettingsCard>
  );
}
