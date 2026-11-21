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
      className={cn(
        'flex items-center text-foreground',
        layout === 'split' ? 'justify-start' : 'mb-8 justify-center gap-3',
      )}
      to="/login"
      reloadDocument={web}
    >
      <span
        className={cn(
          layout === 'split'
            ? 'max-w-full rounded-lg bg-brand-white px-2 py-1 shadow-sm'
            : 'rounded-lg bg-brand-navy px-3 py-1.5',
        )}
      >
        <BrandLogo
          className={cn(
            layout === 'split' ? 'h-auto w-60 max-w-full object-contain' : 'h-10 w-auto object-contain',
          )}
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
        'relative flex min-h-svh items-center justify-center bg-muted/40 px-4 py-12',
        layout === 'split' && 'py-16 sm:px-8 sm:py-14',
      )}
    >
      <div className="absolute right-4 top-4">
        <ThemeSwitcher />
      </div>
      {layout === 'split' ? (
        <div className="grid w-full max-w-6xl overflow-hidden rounded-xl border border-border bg-card shadow-card lg:min-h-[40rem] lg:grid-cols-2">
          <section
            aria-labelledby="auth-brand-heading"
            className="relative isolate flex flex-col gap-10 overflow-hidden bg-brand-navy p-6 text-brand-white sm:p-10 lg:justify-between lg:p-12"
          >
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
              <span className="absolute -right-24 top-20 size-64 rounded-full border border-brand-white/10" />
              <span className="absolute -right-12 top-32 size-40 rounded-full border border-brand-white/10" />
              <span className="absolute bottom-20 right-20 size-28 rounded-full bg-brand-cyan/10 blur-2xl" />
              <span className="absolute bottom-32 right-36 size-16 rounded-full bg-brand-green/10 blur-xl" />
            </div>
            <div className="relative z-10">{homeLink}</div>
            <div className="relative z-10 max-w-xl">
              <p className="mb-3 text-sm font-medium tracking-wide text-brand-white/75">
                Work &amp; Project Management
              </p>
              <h2
                className="text-3xl font-semibold tracking-tight sm:text-4xl"
                id="auth-brand-heading"
              >
                Bring your team’s work into focus.
              </h2>
              <p className="mt-4 max-w-lg text-sm leading-6 text-brand-white/80 sm:text-base sm:leading-7">
                Plan projects, coordinate tasks, and move forward together in one shared workspace.
              </p>
            </div>
            <div className="relative z-10 flex items-center gap-3 border-t border-brand-white/15 pt-5 text-sm text-brand-white/75">
              <span aria-hidden="true" className="size-2 rounded-full bg-brand-cyan" />
              <p>Clear priorities. Connected teams. Measurable progress.</p>
            </div>
          </section>
          <section className="flex items-center justify-center bg-card p-6 text-card-foreground sm:p-10 lg:p-14">
            <div className="w-full max-w-md">
              <div className="mb-8 space-y-3">
                <p className="text-sm font-medium tracking-wide text-primary">Sign in</p>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  {title}
                </h1>
                <p className="text-sm leading-6 text-muted-foreground">{description}</p>
              </div>
              {children}
              {footerContent}
              <p className="mt-6 text-center text-xs text-muted-foreground">
                Secure access to your Hirgal workspace
              </p>
            </div>
          </section>
        </div>
      ) : (
        <div className="w-full max-w-md">
          {homeLink}
          <section className="rounded-xl border bg-card p-6 text-card-foreground shadow-card sm:p-8">
            <div className="mb-6 space-y-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              <p className="text-sm leading-6 text-muted-foreground">{description}</p>
            </div>
            {children}
            {footerContent}
          </section>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Secure access to your Hirgal workspace
          </p>
        </div>
      )}
    </main>
  );
}
