import { act, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { chooseOption } from '@/test/choose-option';
import { ChoiceOption, ChoiceSelect } from './choice-select';

it('preserves required selection and serializes numeric option values', async () => {
  render(
    <form aria-label="Invitation">
      <ChoiceSelect aria-label="Role" name="role" required>
        <ChoiceOption value="">Choose a role</ChoiceOption>
        <ChoiceOption value={12}>Member</ChoiceOption>
      </ChoiceSelect>
    </form>,
  );
  const form = screen.getByRole<HTMLFormElement>('form', { name: 'Invitation' });
  act(() => { expect(form.checkValidity()).toBe(false); });
  expect(screen.getByRole('alert')).toHaveTextContent('Choose an option');
  await chooseOption(screen.getByRole('combobox', { name: 'Role' }), 'Member');
  expect(form.checkValidity()).toBe(true);
  expect(new FormData(form).get('role')).toBe('12');
});
