import { LoadingState } from '@/components/feedback/LoadingState';

function DesignSystemLoadingFallback() {
  return (
    <main className="flex min-h-svh items-center justify-center">
      <LoadingState label="Loading design system" layout="page" />
    </main>
  );
}

export { DesignSystemLoadingFallback };
