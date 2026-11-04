import { Component, type PropsWithChildren } from 'react';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Button } from '@/components/ui/button';

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<
  PropsWithChildren,
  AppErrorBoundaryState
> {
  override state: AppErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  private reset = (): void => {
    this.setState({ hasError: false });
  };

  override render() {
    if (this.state.hasError) {
      return (
        <main className="mx-auto flex min-h-svh w-full max-w-3xl items-center px-6 py-12">
          <ErrorState
            title="The application encountered an error"
            description="You can try rendering the application again."
            action={
              <Button onClick={this.reset} type="button">
                Try again
              </Button>
            }
          />
        </main>
      );
    }

    return this.props.children;
  }
}
