import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/primitives';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DataDisplaySection } from '@/app/router/routes/design-system/DataDisplaySection';
import { FeedbackSection } from '@/app/router/routes/design-system/FeedbackSection';
import { FormsSection } from '@/app/router/routes/design-system/FormsSection';
import { FoundationsSection } from '@/app/router/routes/design-system/FoundationsSection';
import { InteractionSection } from '@/app/router/routes/design-system/InteractionSection';

function DesignSystemShowcaseRoute() {
  return (
    <AppShell breadcrumb="Design system">
      <div className="mx-auto max-w-7xl space-y-8">
        <PageHeader
          description="A development-only reference for Hirgal’s visual language and shared interface components."
          eyebrow="Developer tools"
          title="Design system"
        />
        <Alert variant="info">
          <AlertDescription>
            This showcase is development-only. All names, statuses, and table values are static
            illustrations; there are no business screens or backend requests here.
          </AlertDescription>
        </Alert>
        <FoundationsSection />
        <FormsSection />
        <FeedbackSection />
        <InteractionSection />
        <DataDisplaySection />
      </div>
    </AppShell>
  );
}

export { DesignSystemShowcaseRoute };
