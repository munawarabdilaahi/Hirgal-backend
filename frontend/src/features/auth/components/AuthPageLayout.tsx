import type { PropsWithChildren, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ThemeSwitcher } from '@/components/navigation/theme-switcher';
import { BrandLogo } from '@/components/common/BrandLogo';
import { cn } from '@/lib/utils';

interface AuthPageLayoutProps extends PropsWithChildren {
  title: string;
  description: string;
  footer?: ReactNode;
  layout?: 'centered' | 'split';
  web?: boolean;
}

export function AuthPageLayout({
  children,
  description,
  footer,
  layout = 'centered',
  title,
  web = false,
}: AuthPageLayoutProps) {
  const homeLink = (
    <Link
      aria-label="Hirgal home"
      className="inline-flex items-center"
      reloadDocument={web}
      to="/login"
    >
      <span className="inline-block rounded-2xl bg-brand-white px-5 py-3.5 shadow-md transition-transform hover:scale-[1.02] sm:px-6 sm:py-4">
        <BrandLogo
          className="h-14 w-auto max-w-full object-contain sm:h-16 lg:h-18"
          variant="full"
        />
      </span>
    </Link>
  );

  const footerContent = footer ? (
    <div className="mt-6 border-t pt-5 text-center text-sm text-muted-foreground">
      {footer}
    </div>
  ) : null;

  return (
    <main
      className={cn(
        'relative flex min-h-svh items-center justify-center bg-muted/40 p-4 sm:p-6 lg:p-8',
        layout === 'split' && 'py-12 sm:py-16',
      )}
    >
      <div className="absolute right-4 top-4 z-20">
        <ThemeSwitcher />
      </div>

      {layout === 'split' ? (
        <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-card shadow-card lg:min-h-[36rem] lg:grid-cols-2">
          {/* Left Branding Panel: Upper-left logo with vertically centered marketing section */}
          <section
            aria-label="Hirgal Brand"
            className="relative isolate flex flex-col justify-between overflow-hidden bg-brand-navy p-8 text-brand-white sm:p-10 lg:p-12"
          >
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
              <span className="absolute -right-20 top-16 size-72 rounded-full border border-brand-white/10" />
              <span className="absolute -left-16 bottom-12 size-56 rounded-full border border-brand-white/10" />
              <span className="absolute bottom-16 right-16 size-32 rounded-full bg-brand-cyan/15 blur-2xl" />
              <span className="absolute top-20 left-20 size-24 rounded-full bg-brand-green/15 blur-xl" />
            </div>

            <div className="relative z-10 flex flex-col items-start justify-start">
              {homeLink}
            </div>

            <div className="relative z-10 flex flex-1 flex-col justify-center pt-8 sm:pt-10">
              <div className="max-w-md space-y-3 sm:space-y-4">
                <h2 className="text-2xl font-semibold tracking-tight text-brand-white sm:text-3xl lg:text-[2rem] lg:leading-snug">
                  Bring your team&apos;s work into focus.
                </h2>
                <p className="text-sm leading-relaxed text-brand-white/80 sm:text-base sm:leading-relaxed">
                  Plan projects, manage tasks, collaborate with your team, and achieve more &mdash; all in one workspace.
                </p>
                <div className="pt-1.5 sm:pt-2">
                  <p className="text-xs font-medium tracking-wide text-brand-white/60 sm:text-sm">
                    Plan smarter. Work better. Grow together.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Right Authentication Panel */}
          <section className="flex items-center justify-center bg-card p-6 text-card-foreground sm:p-10 lg:p-12">
            <div className="w-full max-w-sm">
              <div className="mb-6 space-y-1.5 text-center sm:text-left">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  {title}
                </h1>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>

              {children}
              {footerContent}
            </div>
          </section>
        </div>
      ) : (
        <div className="w-full max-w-md">
          <div className="mb-6 flex justify-center">{homeLink}</div>
          <section className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-card sm:p-8">
            <div className="mb-6 space-y-1.5 text-center">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            {children}
            {footerContent}
          </section>
        </div>
      )}
    </main>
  );
}
