import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppProviders } from '@/app/providers/AppProviders';
import { DesignSystemShowcaseRoute } from '@/app/router/routes/DesignSystemShowcaseRoute';

describe('design system showcase', () => {
  it('renders the component foundations without backend integration', () => {
    render(
      <AppProviders>
        <MemoryRouter>
          <DesignSystemShowcaseRoute />
        </MemoryRouter>
      </AppProviders>,
    );

    expect(screen.getByRole('heading', { name: 'Design system' })).toBeInTheDocument();
    expect(
      screen.getByText(/static illustrations; there are no business screens or backend requests/),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Form controls' })).toBeInTheDocument();
    const workspaceNameInput = screen.getByRole('textbox', {
      name: /Workspace name/,
    });
    const helperTextId = workspaceNameInput.getAttribute('aria-describedby');
    expect(helperTextId).not.toBeNull();
    expect(document.getElementById(helperTextId ?? '')).toHaveTextContent(
      'Used only as an illustrative field',
    );
  });

  it('opens accessible dialog and responsive navigation surfaces', async () => {
    render(
      <AppProviders>
        <MemoryRouter>
          <DesignSystemShowcaseRoute />
        </MemoryRouter>
      </AppProviders>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open dialog' }));
    expect(await screen.findByRole('dialog', { name: 'Dialog title' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));

    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    const navigationDialog = await screen.findByRole('dialog', {
      name: 'Hirgal navigation',
    });
    expect(
      within(navigationDialog)
        .getByText('Appointments')
        .closest('[aria-disabled="true"]'),
    ).toBeInTheDocument();
    fireEvent.click(within(navigationDialog).getByRole('link', { name: 'Projects' }));
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Hirgal navigation' }),
      ).not.toBeInTheDocument();
    });
  });

  it('moves focus into a dialog and restores it after Escape', async () => {
    const user = userEvent.setup();
    render(
      <AppProviders>
        <MemoryRouter>
          <DesignSystemShowcaseRoute />
        </MemoryRouter>
      </AppProviders>,
    );

    const trigger = screen.getByRole('button', { name: 'Open dialog' });
    await user.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Dialog title' });

    const activeElement = document.activeElement;
    expect(activeElement instanceof HTMLElement && dialog.contains(activeElement)).toBe(true);
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Dialog title' })).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();
  });
});
