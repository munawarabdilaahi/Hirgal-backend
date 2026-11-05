import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

function Pagination({
  className,
  currentPage,
  onPageChange,
  totalPages,
}: PaginationProps) {
  if (!Number.isInteger(totalPages) || totalPages < 1) {
    return null;
  }

  const visiblePages = Array.from(
    { length: Math.min(totalPages, 5) },
    (_, index) => {
      if (totalPages <= 5 || currentPage <= 3) {
        return index + 1;
      }

      if (currentPage >= totalPages - 2) {
        return totalPages - 4 + index;
      }

      return currentPage - 2 + index;
    },
  );
  const firstVisiblePage = visiblePages[0] ?? 1;
  const lastVisiblePage = visiblePages.at(-1) ?? 1;

  return (
    <nav aria-label="Pagination" className={cn('flex items-center justify-center gap-1', className)}>
      <Button
        aria-label="Go to previous page"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
        size="icon"
        type="button"
        variant="ghost"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
      </Button>
      {firstVisiblePage > 1 ? (
        <>
          <PageButton page={1} currentPage={currentPage} onPageChange={onPageChange} />
          {firstVisiblePage > 2 ? (
            <span aria-hidden="true" className="flex size-9 items-center justify-center text-muted-foreground">
              <MoreHorizontal className="size-4" />
            </span>
          ) : null}
        </>
      ) : null}
      {visiblePages.map((page) => (
        <PageButton
          currentPage={currentPage}
          key={page}
          onPageChange={onPageChange}
          page={page}
        />
      ))}
      {lastVisiblePage < totalPages ? (
        <>
          {lastVisiblePage < totalPages - 1 ? (
            <span aria-hidden="true" className="flex size-9 items-center justify-center text-muted-foreground">
              <MoreHorizontal className="size-4" />
            </span>
          ) : null}
          <PageButton page={totalPages} currentPage={currentPage} onPageChange={onPageChange} />
        </>
      ) : null}
      <Button
        aria-label="Go to next page"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        size="icon"
        type="button"
        variant="ghost"
      >
        <ChevronRight aria-hidden="true" className="size-4" />
      </Button>
    </nav>
  );
}

interface PageButtonProps {
  page: number;
  currentPage: number;
  onPageChange: (page: number) => void;
}

function PageButton({ currentPage, onPageChange, page }: PageButtonProps) {
  return (
    <Button
      aria-current={currentPage === page ? 'page' : undefined}
      aria-label={`Go to page ${page}`}
      onClick={() => onPageChange(page)}
      size="icon"
      type="button"
      variant={currentPage === page ? 'outline' : 'ghost'}
    >
      {page}
    </Button>
  );
}

export { Pagination };
