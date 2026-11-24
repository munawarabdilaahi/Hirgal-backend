import { lazy, Suspense, type ReactNode } from 'react';
import { LoadingState } from '@/components/feedback/LoadingState';

const AcceptInvitationRoute = lazy(async () => {
  const { AcceptInvitationRoute: Component } = await import('@/features/auth/pages/AcceptInvitationRoute');
  return { default: Component };
});
const AccountSettingsRoute = lazy(async () => {
  const { AccountSettingsRoute: Component } = await import('@/features/account/AccountSettingsRoute');
  return { default: Component };
});
const ChangePasswordRoute = lazy(async () => {
  const { ChangePasswordRoute: Component } = await import('@/features/auth/pages/ChangePasswordRoute');
  return { default: Component };
});
const DashboardRoute = lazy(async () => {
  const { DashboardRoute: Component } = await import('@/features/auth/pages/DashboardRoute');
  return { default: Component };
});
const ForgotPasswordRoute = lazy(async () => {
  const { ForgotPasswordRoute: Component } = await import('@/features/auth/pages/ForgotPasswordRoute');
  return { default: Component };
});
const LoginRoute = lazy(async () => {
  const { LoginRoute: Component } = await import('@/features/auth/pages/LoginRoute');
  return { default: Component };
});
const TwoFactorChallengeRoute = lazy(async () => {
  const { TwoFactorChallengeRoute: Component } = await import('@/features/auth/pages/TwoFactorChallengeRoute');
  return { default: Component };
});
const ResetPasswordRoute = lazy(async () => {
  const { ResetPasswordRoute: Component } = await import('@/features/auth/pages/ResetPasswordRoute');
  return { default: Component };
});
const UsersRoute = lazy(async () => {
  const { UsersRoute: Component } = await import('@/features/users/pages/UsersRoute');
  return { default: Component };
});
const UserDetailsRoute = lazy(async () => {
  const { UserDetailsRoute: Component } = await import('@/features/users/pages/UserDetailsRoute');
  return { default: Component };
});
const ProjectsRoute = lazy(async () => {
  const { ProjectsRoute: Component } = await import('@/features/projects/ProjectsRoutes');
  return { default: Component };
});
const ProjectDetailsRoute = lazy(async () => {
  const { ProjectDetailsRoute: Component } = await import('@/features/projects/ProjectsRoutes');
  return { default: Component };
});
const ProjectFormRoute = lazy(async () => {
  const { ProjectFormRoute: Component } = await import('@/features/projects/ProjectsRoutes');
  return { default: Component };
});
const TeamsRoute = lazy(async () => {
  const { TeamsRoute: Component } = await import('@/features/teams/TeamsRoutes');
  return { default: Component };
});
const TeamDetailsRoute = lazy(async () => {
  const { TeamDetailsRoute: Component } = await import('@/features/teams/TeamsRoutes');
  return { default: Component };
});
const TeamFormRoute = lazy(async () => {
  const { TeamFormRoute: Component } = await import('@/features/teams/TeamsRoutes');
  return { default: Component };
});
const HabitsRoute = lazy(async () => {
  const { HabitsRoute: Component } = await import('@/features/habits/pages/HabitsRoute');
  return { default: Component };
});
const HabitDetailsRoute = lazy(async () => {
  const { HabitDetailsRoute: Component } = await import('@/features/habits/pages/HabitDetailsRoute');
  return { default: Component };
});
const HabitFormRoute = lazy(async () => {
  const { HabitFormRoute: Component } = await import('@/features/habits/pages/HabitFormRoute');
  return { default: Component };
});
const NotificationsRoute = lazy(async () => {
  const { NotificationsRoute: Component } = await import('@/features/follow-up/FollowUpRoutes');
  return { default: Component };
});
const ActivityRoute = lazy(async () => {
  const { ActivityRoute: Component } = await import('@/features/follow-up/FollowUpRoutes');
  return { default: Component };
});
const TasksRoute = lazy(async () => {
  const { TasksRoute: Component } = await import('@/features/tasks/TasksRoute');
  return { default: Component };
});
const AppointmentsRoute = lazy(async () => {
  const { AppointmentsRoute: Component } = await import('@/features/appointments/AppointmentsRoute');
  return { default: Component };
});

function renderLazyPage(page: ReactNode) {
  return (
    <Suspense fallback={<LoadingState label="Loading page" layout="page" />}>
      {page}
    </Suspense>
  );
}

export function ChangePasswordPage() {
  return renderLazyPage(<ChangePasswordRoute />);
}

export function AcceptInvitationPage() {
  return renderLazyPage(<AcceptInvitationRoute />);
}

export function DashboardPage() {
  return renderLazyPage(<DashboardRoute />);
}

export function ForgotPasswordPage() {
  return renderLazyPage(<ForgotPasswordRoute />);
}

export function LoginPage() {
  return renderLazyPage(<LoginRoute />);
}

export function TwoFactorChallengePage() {
  return renderLazyPage(<TwoFactorChallengeRoute />);
}

export function AccountSettingsPage() {
  return renderLazyPage(<AccountSettingsRoute />);
}

export function ResetPasswordPage() {
  return renderLazyPage(<ResetPasswordRoute />);
}

export function UsersPage() {
  return renderLazyPage(<UsersRoute />);
}

export function UserDetailsPage() {
  return renderLazyPage(<UserDetailsRoute />);
}

export function ProjectsPage() { return renderLazyPage(<ProjectsRoute />); }
export function ProjectDetailsPage() { return renderLazyPage(<ProjectDetailsRoute />); }
export function ProjectFormPage() { return renderLazyPage(<ProjectFormRoute />); }
export function TeamsPage() { return renderLazyPage(<TeamsRoute />); }
export function TeamDetailsPage() { return renderLazyPage(<TeamDetailsRoute />); }
export function TeamFormPage() { return renderLazyPage(<TeamFormRoute />); }
export function HabitsPage() { return renderLazyPage(<HabitsRoute />); }
export function HabitDetailsPage() { return renderLazyPage(<HabitDetailsRoute />); }
export function HabitFormPage() { return renderLazyPage(<HabitFormRoute />); }
export function NotificationsPage() { return renderLazyPage(<NotificationsRoute />); }
export function ActivityPage() { return renderLazyPage(<ActivityRoute />); }
export function TasksPage() { return renderLazyPage(<TasksRoute />); }
export function MyWorkPage() { return renderLazyPage(<TasksRoute assignedToMe />); }
export function AppointmentsPage() { return renderLazyPage(<AppointmentsRoute />); }
