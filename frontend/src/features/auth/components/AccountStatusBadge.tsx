import { StatusBadge } from '@/components/ui/status-badge';
import type { AccountStatus } from '@/services/api/contracts';

interface AccountStatusBadgeProps {
  status: AccountStatus;
}

export function AccountStatusBadge({ status }: AccountStatusBadgeProps) {
  if (status === 'suspended') {
    return <StatusBadge label="Suspended" status="blocked" />;
  }

  return <StatusBadge status={status} />;
}
