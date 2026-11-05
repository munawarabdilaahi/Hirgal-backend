import { DeferredRoute } from '@/app/router/routes/DeferredRoute';
import { RequirePermission } from '@/features/auth/components/AuthRouteGuards';

interface ProtectedDeferredRouteProps {
  name: string;
  permission: string;
}

export function ProtectedDeferredRoute({
  name,
  permission,
}: ProtectedDeferredRouteProps) {
  return (
    <RequirePermission permission={permission}>
      <DeferredRoute name={name} />
    </RequirePermission>
  );
}
