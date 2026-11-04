import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SpinnerProps {
  label?: string;
  className?: string;
}

function Spinner({ className, label = 'Loading' }: SpinnerProps) {
  return (
    <span aria-label={label} className="inline-flex items-center" role="status">
      <LoaderCircle aria-hidden="true" className={cn('size-4 animate-spin', className)} />
    </span>
  );
}

export { Spinner };
