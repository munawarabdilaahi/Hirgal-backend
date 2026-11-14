import { createInertiaApp } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';
import { AppProviders } from '@/app/providers/AppProviders';
import '@/pages/currentEmailLink';
import '@/styles/globals.css';

const pages = import.meta.glob<{ default: React.ComponentType }>('./pages/*.tsx');

void createInertiaApp({
  resolve: async (name) => {
    const loadPage = pages[`./pages/${name}.tsx`];
    if (!loadPage) {
      throw new Error(`Unknown Inertia page: ${name}`);
    }
    return (await loadPage()).default;
  },
  setup({ el, App, props }) {
    createRoot(el).render(
      <AppProviders>
        <App {...props} />
      </AppProviders>,
    );
  },
});
