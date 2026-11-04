import {
  Activity,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  CircleHelp,
  FolderKanban,
  LayoutDashboard,
  Menu,
  MessageSquareText,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useState } from 'react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ThemeSwitcher } from '@/components/navigation/theme-switcher';
import { cn } from '@/lib/utils';

type NavigationItemConfig = {
  label: string;
  icon: LucideIcon;
  to?: string;
  status?: 'planned';
};

type NavigationGroupConfig = {
  label: string;
  items: NavigationItemConfig[];
};

const navigationGroups: NavigationGroupConfig[] = [
  {
    label: 'Workspace',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
      { label: 'My work', icon: CheckSquare, status: 'planned' },
      { label: 'Projects', icon: FolderKanban, to: '/projects' },
      { label: 'Teams', icon: UsersRound, to: '/teams' },
      { label: 'Tasks', icon: CheckSquare, to: '/tasks' },
    ],
  },
  {
    label: 'Personal',
    items: [
      { label: 'Appointments', icon: CalendarDays, status: 'planned' },
      { label: 'Habits', icon: Activity, status: 'planned' },
      { label: 'Follow-up inbox', icon: MessageSquareText, status: 'planned' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'People & access', icon: Users, to: '/users' },
      { label: 'Activity', icon: CircleHelp, status: 'planned' },
    ],
  },
  ...(import.meta.env.DEV
    ? [
        {
          label: 'Developer',
          items: [
            {
              label: 'Design system',
              icon: CircleHelp,
              to: '/dev/design-system',
            },
          ],
        },
      ]
    : []),
];

interface SidebarProps {
  onNavigate?: () => void;
}

function Sidebar({ onNavigate }: SidebarProps) {
  const { pathname } = useLocation();

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center gap-3 px-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
          H
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold tracking-tight">Hirgal</p>
          <p className="truncate text-xs text-sidebar-muted">Workspace</p>
        </div>
        <Button
          aria-label="Select workspace"
          className="size-8 text-sidebar-muted hover:text-sidebar-foreground"
          disabled
          size="icon"
          variant="ghost"
        >
          <ChevronDown aria-hidden="true" className="size-4" />
        </Button>
      </div>
      <Separator className="bg-border/80" />
      <nav aria-label="Main navigation" className="flex-1 space-y-7 overflow-y-auto px-3 py-5">
        {navigationGroups.map((group) => (
          <section aria-label={group.label} key={group.label}>
            <h2 className="mb-2 px-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-sidebar-muted">
              {group.label}
            </h2>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = item.to === pathname;

                return (
                  <li key={item.label}>
                    {item.to ? (
                      <NavLink
                        aria-current={isActive ? 'page' : undefined}
                        className={({ isActive: routeIsActive }) =>
                          cn(
                            'flex min-h-10 items-center gap-3 rounded-md px-2.5 text-sm transition-colors hover:bg-sidebar-active/70 hover:text-sidebar-active-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            routeIsActive
                              ? 'bg-sidebar-active font-medium text-sidebar-active-foreground'
                              : 'text-sidebar-foreground',
                          )
                        }
                        onClick={onNavigate}
                        to={item.to}
                      >
                        <Icon aria-hidden="true" className="size-4 shrink-0" />
                        <span className="flex-1 truncate">{item.label}</span>
                      </NavLink>
                    ) : (
                      <span
                        aria-disabled="true"
                        className="flex min-h-10 cursor-not-allowed items-center gap-3 rounded-md px-2.5 text-sm text-sidebar-muted opacity-80"
                        title="Planned for a future phase"
                      >
                        <Icon aria-hidden="true" className="size-4 shrink-0" />
                        <span className="flex-1 truncate">{item.label}</span>
                        <span className="rounded border border-border/70 px-1.5 py-0.5 text-[0.625rem] leading-none">
                          Planned
                        </span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </nav>
      <div className="p-3">
        <div className="flex items-center gap-3 rounded-lg border border-border/70 p-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-active text-xs font-semibold text-sidebar-active-foreground">
            UI
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">Interface preview</p>
            <p className="truncate text-xs text-sidebar-muted">Design system</p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface BreadcrumbsProps {
  current: string;
}

function Breadcrumbs({ current }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-2 text-sm">
        <li>
          <Link className="text-muted-foreground hover:text-foreground" to="/dashboard">
            Workspace
          </Link>
        </li>
        <li aria-hidden="true" className="text-muted-foreground">/</li>
        <li aria-current="page" className="font-medium text-foreground">{current}</li>
      </ol>
    </nav>
  );
}

interface AppShellProps {
  children: React.ReactNode;
  breadcrumb: string;
}

function AppShell({ breadcrumb, children }: AppShellProps) {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  return (
    <div className="min-h-svh bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-sidebar md:block">
        <Sidebar />
      </aside>
      <div className="md:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur-sm sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Dialog open={mobileNavigationOpen} onOpenChange={setMobileNavigationOpen}>
              <DialogTrigger asChild>
                <Button
                  aria-label="Open navigation menu"
                  className="md:hidden"
                  size="icon"
                  variant="ghost"
                >
                  <Menu aria-hidden="true" className="size-5" />
                </Button>
              </DialogTrigger>
              <DialogContent
                className="left-0 top-0 h-svh max-h-none w-[min(20rem,85vw)] max-w-none translate-x-0 translate-y-0 gap-0 rounded-none border-y-0 border-l-0 p-0 data-[state=open]:animate-[drawer-enter_180ms_ease-out] data-[state=closed]:animate-[drawer-exit_140ms_ease-in] sm:rounded-none"
                showClose={false}
              >
                <DialogTitle className="sr-only">Hirgal navigation</DialogTitle>
                <DialogDescription className="sr-only">
                  Browse workspace and personal navigation.
                </DialogDescription>
                <Sidebar onNavigate={() => setMobileNavigationOpen(false)} />
                <DialogClose asChild>
                  <Button
                    aria-label="Close navigation menu"
                    className="absolute right-3 top-3 z-10 md:hidden"
                    size="icon"
                    variant="ghost"
                  >
                    <span aria-hidden="true" className="text-lg leading-none">×</span>
                  </Button>
                </DialogClose>
              </DialogContent>
            </Dialog>
            <div className="hidden min-w-0 sm:block">
              <Breadcrumbs current={breadcrumb} />
            </div>
            <p className="truncate text-sm font-medium sm:hidden">{breadcrumb}</p>
          </div>
          <ThemeSwitcher />
        </header>
        <main className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export { AppShell, Breadcrumbs, Sidebar };
