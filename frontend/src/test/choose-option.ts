import { fireEvent, screen, waitFor } from '@testing-library/react';
import { expect } from 'vitest';

export async function chooseOption(trigger: HTMLElement, name: string | RegExp) {
  await waitFor(() => expect(trigger).toBeEnabled());
  fireEvent.keyDown(trigger, { key: 'Enter' });
  fireEvent.click(await screen.findByRole('option', { name }));
}
