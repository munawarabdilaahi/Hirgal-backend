import { Badge, type BadgeProps } from '@/components/ui/badge';

const statusVariants = {
  active: 'success',
  complete: 'success',
  blocked: 'destructive',
  pending: 'warning',
  planned: 'info',
  neutral: 'secondary',
} as const satisfies Record<string, NonNullable<BadgeProps['variant']>>;

type StatusName = keyof typeof statusVariants;

interface StatusBadgeProps extends Omit<BadgeProps, 'variant'> {
  status: StatusName;
  label?: string;
}

function StatusBadge({ label, status, ...props }: StatusBadgeProps) {
  const statusLabel = label ?? status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <Badge variant={statusVariants[status]} {...props}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current opacity-80" />
      {statusLabel}
    </Badge>
  );
}

export { StatusBadge, type StatusName };
