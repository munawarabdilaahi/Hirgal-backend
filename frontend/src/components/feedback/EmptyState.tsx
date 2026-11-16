import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
}

export function EmptyState({ title, description, icon }: EmptyStateProps) {
  return (
    <div className="workspace-surface flex min-h-27 flex-col items-center justify-center gap-2 border-dashed p-4 text-center">
      <span aria-hidden="true" className="text-muted-foreground">{icon ?? <Inbox className="size-5" />}</span>
      <h2 className="text-sm font-medium">{title}</h2>
      {description && <p className="max-w-lg text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}
