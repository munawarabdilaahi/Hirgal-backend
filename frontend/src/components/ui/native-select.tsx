import type { ComponentPropsWithRef } from 'react';
import { cn } from '@/lib/utils';

export function NativeSelect({ className, ...props }: ComponentPropsWithRef<'select'>) {
  return (
    <select
      className={cn('h-10 min-w-0 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50', className)}
      {...props}
    />
  );
}
