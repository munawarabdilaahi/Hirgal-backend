import { Bell, ShieldCheck, SlidersHorizontal, UserRound, UsersRound, LockKeyhole } from 'lucide-react';
import type { ComponentType } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/primitives';
import type { ApiUser, UpdateProfileRequest } from '@/services/api/contracts';
import { NotificationsSection } from './NotificationsSection';
import { PreferencesSection } from './PreferencesSection';
import { PrivacySection } from './PrivacySection';
import { ProfileSection } from './ProfileSection';
import { SecuritySection } from './SecuritySection';
import { SessionsSection } from './SessionsSection';

export type AccountSection = 'profile' | 'security' | 'sessions' | 'notifications' | 'preferences' | 'privacy';

const sections: { id: AccountSection; label: string; description: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: 'profile', label: 'Profile', description: 'Photo, name, and contact details', icon: UserRound },
  { id: 'security', label: 'Security', description: 'Password, two-factor, activity', icon: ShieldCheck },
  { id: 'sessions', label: 'Sessions', description: 'Devices and sign-ins', icon: UsersRound },
  { id: 'notifications', label: 'Notifications', description: 'What you get notified about', icon: Bell },
  { id: 'preferences', label: 'Preferences', description: 'Language, dates, times', icon: SlidersHorizontal },
  { id: 'privacy', label: 'Privacy and data', description: 'Export, deactivate, delete', icon: LockKeyhole },
];

function isSection(value: string | null): value is AccountSection {
  return sections.some((section) => section.id === value);
}

export function AccountSettings({
  user,
  save,
  onUserChanged,
  onSignedOut,
}: {
  user: ApiUser;
  save: (payload: UpdateProfileRequest) => Promise<void>;
  onUserChanged: (user: ApiUser) => void;
  onSignedOut: () => void;
}) {
  const [params, setParams] = useSearchParams();
  const requested = params.get('section');
  const active: AccountSection = isSection(requested) ? requested : 'profile';
  const profile = user.profile ?? null;
  const timeFormat = profile?.time_format ?? '24h';

  function go(section: AccountSection) {
    const next = new URLSearchParams(params);
    next.set('section', section);
    setParams(next, { replace: false });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="Manage your profile, sign-in security, sessions, notifications, and account data."
        eyebrow="Account settings"
        title="Your account"
      />
      <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav aria-label="Account settings sections" className="lg:sticky lg:top-20 lg:self-start">
          <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {sections.map((section) => {
              const Icon = section.icon;
              const selected = active === section.id;
              return (
                <li className="shrink-0" key={section.id}>
                  <button
                    aria-current={selected ? 'page' : undefined}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      selected
                        ? 'bg-secondary font-medium text-secondary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    }`}
                    onClick={() => go(section.id)}
                    type="button"
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="min-w-0">
                      <span className="block whitespace-nowrap">{section.label}</span>
                      <span className="hidden text-xs font-normal text-muted-foreground xl:block">
                        {section.description}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="min-w-0">
          {active === 'profile' ? (
            <ProfileSection
              onUserChanged={onUserChanged}
              profile={profile}
              save={save}
              timeFormat={timeFormat}
              user={user}
            />
          ) : null}
          {active === 'security' ? (
            <SecuritySection onUserChanged={onUserChanged} timeFormat={timeFormat} user={user} />
          ) : null}
          {active === 'sessions' ? <SessionsSection timeFormat={timeFormat} /> : null}
          {active === 'notifications' ? <NotificationsSection profile={profile} save={save} /> : null}
          {active === 'preferences' ? <PreferencesSection profile={profile} save={save} user={user} /> : null}
          {active === 'privacy' ? <PrivacySection onSignedOut={onSignedOut} /> : null}
        </div>
      </div>
    </div>
  );
}
