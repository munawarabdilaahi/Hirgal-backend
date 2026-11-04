import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { Toaster } from 'sonner';
import { ApiError } from '@/services/api/ApiError';
import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { useTheme } from '@/app/providers/useTheme';
import { TooltipProvider } from '@/components/ui/tooltip';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) =>
        error instanceof ApiError && error.status === null && failureCount < 1,
      refetchOnWindowFocus: true,
      staleTime: 30_000,
    },
    mutations: {
      retry: false,
    },
  },
});

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ApplicationFeedback>{children}</ApplicationFeedback>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

function ApplicationFeedback({ children }: PropsWithChildren) {
  const { resolvedTheme } = useTheme();

  return (
    <TooltipProvider delayDuration={300}>
      {children}
      <Toaster closeButton position="bottom-right" richColors theme={resolvedTheme} />
    </TooltipProvider>
  );
}
