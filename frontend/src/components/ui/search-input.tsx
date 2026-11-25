import type { ComponentProps } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function SearchInput({ className, ...props }: ComponentProps<typeof Input>) {
  return (
    <div className="relative min-w-0">
      <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
      <Input className={cn('pl-9', className)} {...props} />
    </div>
  );
}
