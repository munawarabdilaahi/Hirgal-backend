import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const colorTokens = [
  { name: 'Background', classes: 'bg-background' },
  { name: 'Foreground', classes: 'bg-foreground' },
  { name: 'Primary', classes: 'bg-primary' },
  { name: 'Secondary', classes: 'bg-secondary' },
  { name: 'Muted', classes: 'bg-muted' },
  { name: 'Accent', classes: 'bg-accent' },
  { name: 'Success', classes: 'bg-success' },
  { name: 'Warning', classes: 'bg-warning' },
  { name: 'Information', classes: 'bg-info' },
  { name: 'Destructive', classes: 'bg-destructive' },
  { name: 'Sidebar', classes: 'bg-sidebar' },
  { name: 'Border', classes: 'bg-border' },
];

function FoundationsSection() {
  return (
    <section aria-labelledby="foundations-title" className="space-y-4">
      <div>
        <h2 className="text-section-title font-semibold tracking-tight" id="foundations-title">
          Foundations
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A calm, neutral workspace palette with a focused blue primary and semantic status colors.
          Change the theme from the header to preview both color schemes.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Semantic color tokens</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {colorTokens.map(({ classes, name }) => (
              <div className="space-y-2" key={name}>
                <div
                  aria-label={`${name} color token`}
                  className={`h-12 rounded-md border border-border ${classes}`}
                />
                <p className="text-xs font-medium text-muted-foreground">{name}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Type scale</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Display</p>
            <p className="text-display font-semibold tracking-tight">Work, in focus.</p>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Page title</p>
            <p className="text-page-title font-semibold tracking-tight">Design system</p>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Section title</p>
            <p className="text-section-title font-semibold">Project overview</p>
          </div>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Body copy uses a readable system-first sans stack, generous line height, and subdued
            secondary text. Metadata remains compact without falling below accessible contrast.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}

export { FoundationsSection };
