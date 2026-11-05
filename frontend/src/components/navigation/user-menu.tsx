import { LogOut, Settings, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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

interface UserMenuProps {
  name?: string;
  detail?: string;
}

function UserMenu({ detail: passedDetail, name: demoName }: UserMenuProps) {
  const { logout, user } = useAuth();
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
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-36 truncate text-sm font-medium sm:inline">{name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
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
              <Link to="/profile">
                <UserRound aria-hidden="true" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/change-password">
                <Settings aria-hidden="true" />
                Password &amp; security
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={isSigningOut}
              onSelect={(event) => {
                event.preventDefault();
                void signOut();
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
