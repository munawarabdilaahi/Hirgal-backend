import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppProviders } from '@/app/providers/AppProviders';
import App from '@/App';

describe('application routes', () => {
  it('redirects the root route to an explicit deferred feature route', async () => {
    render(
      <AppProviders>
        <App />
      </AppProviders>,
    );

    expect(await screen.findByText('Frontend foundation')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(
      screen.getByText(/Its screen and API integration have not been implemented/),
    ).toBeInTheDocument();
  });
});
