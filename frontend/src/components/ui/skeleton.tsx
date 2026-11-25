import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('ui-skeleton rounded-md bg-muted', className)}
      {...props}
    />
  );
}

export { Skeleton };
