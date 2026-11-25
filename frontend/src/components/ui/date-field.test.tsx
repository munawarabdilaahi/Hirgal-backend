import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { DateField } from './date-field';
import { DateTimeField } from './date-time-field';

it('chooses a bounded calendar date, serializes it and restores the default on reset', () => {
  render(
    <form aria-label="Dates">
      <DateField aria-label="Due date" name="due_date" defaultValue="2026-11-10" max="2026-11-20" />
      <button type="reset">Clear</button>
    </form>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Open calendar for Due date' }));
  expect(screen.getByRole('button', { name: /November 21, 2026/ })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: /November 20, 2026/ }));
  const form = screen.getByRole<HTMLFormElement>('form', { name: 'Dates' });
  expect(new FormData(form).get('due_date')).toBe('2026-11-20');
  fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
  expect(new FormData(form).get('due_date')).toBe('2026-11-10');
  fireEvent.change(screen.getByRole('textbox', { name: 'Due date' }), { target: { value: '2026-02-30' } });
  expect(form.checkValidity()).toBe(false);
});

it('keeps the appointment offset and serializes time with seconds', () => {
  render(<form aria-label="Appointment"><DateTimeField label="Starts at" name="start_time" defaultValue="2026-11-20T09:30:15+03:00" /></form>);
  const form = screen.getByRole<HTMLFormElement>('form', { name: 'Appointment' });
  expect(new FormData(form).get('start_time')).toBe('2026-11-20T09:30:15+03:00');
  fireEvent.change(screen.getByRole('textbox', { name: 'Starts at time' }), { target: { value: '10:45' } });
  expect(form.checkValidity()).toBe(true);
  expect(new FormData(form).get('start_time')).toBe('2026-11-20T10:45:00+03:00');
});
