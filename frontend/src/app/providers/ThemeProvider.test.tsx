import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { useTheme } from '@/app/providers/useTheme';

function ThemeProbe() {
  const { preference, resolvedTheme, setPreference } = useTheme();

  return (
    <div>
      <p>
        {preference}:{resolvedTheme}
      </p>
      <button onClick={() => setPreference('dark')} type="button">
        Use dark theme
      </button>
    </div>
  );
}

describe('theme preference', () => {
  it('restores a saved theme and applies it to the document', async () => {
    window.localStorage.setItem('hirgal-theme', 'dark');

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByText('dark:dark')).toBeInTheDocument();
    await waitFor(() => {
      expect(document.documentElement).toHaveClass('dark');
    });
  });

  it('persists an explicit theme selection', async () => {
    window.localStorage.removeItem('hirgal-theme');

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Use dark theme' }));

    expect(await screen.findByText('dark:dark')).toBeInTheDocument();
    await waitFor(() => {
      expect(window.localStorage.getItem('hirgal-theme')).toBe('dark');
      expect(document.documentElement).toHaveClass('dark');
    });
  });
});
