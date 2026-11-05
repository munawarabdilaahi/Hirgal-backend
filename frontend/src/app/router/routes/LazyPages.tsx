import { lazy, Suspense, type ReactNode } from 'react';
import { LoadingState } from '@/components/feedback/LoadingState';

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
const ProfileRoute = lazy(async () => {
  const { ProfileRoute: Component } = await import('@/features/auth/pages/ProfileRoute');
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

function renderLazyPage(page: ReactNode) {
  return (
    <Suspense fallback={<div className="flex min-h-48 items-center justify-center"><LoadingState label="Loading page" /></div>}>
      {page}
    </Suspense>
  );
}

export function ChangePasswordPage() {
  return renderLazyPage(<ChangePasswordRoute />);
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

export function ProfilePage() {
  return renderLazyPage(<ProfileRoute />);
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
