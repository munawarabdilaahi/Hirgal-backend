import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppErrorBoundary } from '@/components/feedback/AppErrorBoundary';
import { AppProviders } from '@/app/providers/AppProviders';
import { appConfig } from '@/app/config/env';
import App from '@/App';
import '@/styles/globals.css';

document.title = appConfig.name;

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('The application root element was not found.');
}

createRoot(rootElement).render(
  <StrictMode>
    <AppErrorBoundary>
      <AppProviders>
        <App />
      </AppProviders>
    </AppErrorBoundary>
  </StrictMode>,
);
