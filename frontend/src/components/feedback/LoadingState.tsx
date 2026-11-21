import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { BrandLogo } from '@/components/common/BrandLogo';
import { cn } from '@/lib/utils';

interface LoadingStateProps {
  label?: string;
  layout?: 'list' | 'table' | 'cards' | 'form' | 'detail' | 'page' | 'inline' | 'control' | 'board';
  rows?: number;
  columns?: number;
  className?: string;
  rowClassName?: string;
}

export function LoadingState({ label = 'Loading', layout = 'list', rows, columns = 3, className, rowClassName }: LoadingStateProps) {
  const count = rows ?? (layout === 'board' ? 6 : 3);
  return (
    <div aria-label={label} className={cn('w-full min-w-0', className)} role="status">
      <span className="sr-only">{label}</span>
      {layout === 'inline' || layout === 'control' ? (
        <Skeleton className={layout === 'control' ? 'h-10 w-full' : 'h-5 w-full max-w-40'} />
      ) : (
        <div aria-hidden="true" className="space-y-4">
          {(layout === 'page' || layout === 'detail' || layout === 'form') && (
            <div className="space-y-2 border-b pb-4">
              {layout === 'page' ? <BrandLogo className="mb-4 size-8" variant="icon" /> : null}
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-2/3 max-w-64" />
              <Skeleton className="h-4 w-4/5 max-w-96" />
            </div>
          )}
          {layout === 'cards' ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: count }, (_, index) => (
                <Card className={cn(index === 1 && 'hidden md:block', index >= 2 && 'hidden xl:block')} key={index}>
                  <CardHeader className="gap-3">
                    <div className="flex justify-between gap-4"><Skeleton className="size-5" /><Skeleton className="h-6 w-16" /></div>
                    <Skeleton className="h-5 w-3/4" />
                    <div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></div>
                  </CardHeader>
                  <CardContent className="flex justify-between gap-3">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-1/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : layout === 'board' ? (
            <div className="grid auto-cols-[minmax(11rem,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2">
              {Array.from({ length: count }, (_, index) => (
                <div className="space-y-2 rounded-lg border p-3" key={index}>
                  <Skeleton className="h-6 w-2/3" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          ) : layout === 'form' ? (
            <div className="space-y-5 rounded-xl border bg-card p-6">
              {Array.from({ length: count }, (_, index) => (
                <div className="space-y-2" key={index}><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
              ))}
              <Skeleton className="ml-auto h-10 w-28" />
            </div>
          ) : (
            <div className="divide-y rounded-xl border bg-card">
              {layout === 'table' && <div className="flex gap-4 rounded-t-xl bg-muted/40 px-4 py-3">
                {Array.from({ length: columns }, (_, index) => <div className="min-w-0 flex-1" key={index}><Skeleton className="h-3 w-2/3 max-w-24" /></div>)}
              </div>}
              {Array.from({ length: count }, (_, row) => (
                <div className={cn('flex min-h-16 items-center gap-4 px-4 py-3', rowClassName)} key={row}>
                  {layout === 'table' ? Array.from({ length: columns }, (_, column) => (
                    <div className="min-w-0 flex-1" key={column}><Skeleton className="h-4 w-4/5 max-w-32" /></div>
                  )) : (
                    <>
                      <Skeleton className="size-8 shrink-0" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/5 max-w-56" />
                        <Skeleton className="h-3 w-2/5 max-w-36" />
                      </div>
                      <Skeleton className="h-5 w-12 shrink-0" />
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
