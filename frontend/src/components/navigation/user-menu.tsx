import { Bell, LogOut, Settings, ShieldCheck, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/features/auth/auth-hooks';
import type { ApiUser } from '@/services/api/contracts';

interface UserMenuProps {
  name?: string;
  detail?: string;
  session?: { user: ApiUser; frontendUrl: string; logout: () => void } | undefined;
}

function UserMenu({ detail: passedDetail, name: demoName, session }: UserMenuProps) {
  const { logout, user: apiUser } = useAuth();
  const user = session?.user ?? apiUser;
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const name = demoName ?? user?.name;
  const detail = demoName ? passedDetail : user?.email;

  if (!name) {
    return null;
  }

  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();

  const signOut = async () => {
    if (demoName) {
      return;
    }

    setIsSigningOut(true);

    try {
      await logout();
    } catch {
      toast.error('Your session was cleared here, but the server could not confirm sign out.');
    } finally {
      setIsSigningOut(false);
      navigate('/login', { replace: true });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Open account menu for ${name}`}
          className="h-auto gap-2 px-2 py-1.5"
          variant="ghost"
        >
          <Avatar aria-hidden="true" className="size-8">
            {user?.avatar_url ? <AvatarImage alt="" src={user.avatar_url} /> : null}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-36 truncate text-sm font-medium sm:inline">{name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm font-medium text-foreground">{name}</span>
          <span className="mt-1 block truncate text-xs text-muted-foreground">{detail}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {demoName ? (
          <>
            <DropdownMenuItem disabled>
              <UserRound aria-hidden="true" />
              Profile settings
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <Settings aria-hidden="true" />
              Preferences
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <LogOut aria-hidden="true" />
              Sign out
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem asChild>
              <Link reloadDocument={Boolean(session)} to="/profile?section=profile">
                <UserRound aria-hidden="true" />
                Profile and account
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link reloadDocument={Boolean(session)} to="/profile?section=security">
                <ShieldCheck aria-hidden="true" />
                Password &amp; security
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link reloadDocument={Boolean(session)} to="/profile?section=notifications">
                <Bell aria-hidden="true" />
                Notifications
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link reloadDocument={Boolean(session)} to="/profile?section=preferences">
                <Settings aria-hidden="true" />
                Preferences
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={isSigningOut}
              onSelect={(event) => {
                event.preventDefault();
                if (session) {
                  session.logout();
                } else {
                  void signOut();
                }
              }}
            >
              <LogOut aria-hidden="true" />
              {isSigningOut ? 'Signing out…' : 'Sign out'}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { UserMenu };
