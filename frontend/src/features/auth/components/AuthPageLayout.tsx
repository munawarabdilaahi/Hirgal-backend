import type { PropsWithChildren, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ThemeSwitcher } from '@/components/navigation/theme-switcher';
import { BrandLogo } from '@/components/common/BrandLogo';

interface AuthPageLayoutProps extends PropsWithChildren {
  title: string;
  description: string;
  footer?: ReactNode;
  web?: boolean;
}

export function AuthPageLayout({
  children,
  description,
  footer,
  title,
  web = false,
}: AuthPageLayoutProps) {
  return (
    <main className="relative flex min-h-svh items-center justify-center bg-muted/40 px-4 py-12">
      <div className="absolute right-4 top-4">
        <ThemeSwitcher />
      </div>
      <div className="w-full max-w-md">
        <Link
          aria-label="Hirgal home"
          className="mb-8 flex items-center justify-center gap-3 text-foreground"
          to="/login"
          reloadDocument={web}
        >
          <span className="rounded-lg bg-brand-navy px-3 py-1.5">
            <BrandLogo className="h-10 w-auto object-contain" />
          </span>
        </Link>
        <section className="rounded-xl border bg-card p-6 text-card-foreground shadow-card sm:p-8">
          <div className="mb-6 space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
          {children}
          {footer ? (
            <div className="mt-6 border-t pt-5 text-center text-sm text-muted-foreground">
              {footer}
            </div>
          ) : null}
        </section>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Secure access to your Hirgal workspace
        </p>
      </div>
    </main>
  );
}
