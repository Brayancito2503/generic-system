// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeToggle } from './theme-toggle';

const mocks = vi.hoisted(() => ({
  setTheme: vi.fn<(theme: string) => void>(),
}));

// Real API of the component: `useTheme()` is consumed but only `setTheme` is
// used; `theme` is reflected in CSS-only dark: classes, not in JS behavior.
vi.mock('@wrksz/themes/client', () => ({
  useTheme: () => ({ theme: 'light', setTheme: mocks.setTheme }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => `sidebar.theme.${key}`,
}));

describe('ThemeToggle', () => {
  it('renders an enabled trigger after mount (mounted state) and opens the menu', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    const trigger = screen.getByRole('button', { name: 'sidebar.theme.title' });
    // Before mount the button is rendered disabled; after React effects run
    // (inside render+act) it must be the live dropdown trigger.
    expect(trigger).not.toBeDisabled();
    await user.click(trigger);
    await expect(
      screen.findByRole('menuitem', { name: 'sidebar.theme.light' })
    ).resolves.toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: 'sidebar.theme.dark' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: 'sidebar.theme.system' })
    ).toBeInTheDocument();
  });

  it('calls setTheme("dark") when the Dark option is chosen', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(screen.getByRole('button', { name: 'sidebar.theme.title' }));
    await user.click(await screen.findByRole('menuitem', { name: 'sidebar.theme.dark' }));
    expect(mocks.setTheme).toHaveBeenCalledWith('dark');
  });

  it('calls setTheme("light") when the Light option is chosen', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(screen.getByRole('button', { name: 'sidebar.theme.title' }));
    await user.click(await screen.findByRole('menuitem', { name: 'sidebar.theme.light' }));
    expect(mocks.setTheme).toHaveBeenCalledWith('light');
  });

  it('works in menuItem variant with a custom label', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle variant="menuItem" text="Tema" />);
    expect(screen.getByText('Tema')).toBeInTheDocument();
    await user.click(screen.getByText('Tema'));
    await user.click(await screen.findByRole('menuitem', { name: 'sidebar.theme.system' }));
    expect(mocks.setTheme).toHaveBeenCalledWith('system');
  });
});