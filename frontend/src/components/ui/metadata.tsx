import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface MetadataItem {
  label: string;
  value: ReactNode;
}

interface MetadataProps {
  items: MetadataItem[];
  className?: string;
}

function Metadata({ className, items }: MetadataProps) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-3 sm:grid-cols-2', className)}>
      {items.map(({ label, value }) => (
        <div className="grid gap-1" key={label}>
          <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
          <dd className="text-sm text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export { Metadata, type MetadataItem };
