// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SelectLanguage } from './selectLanguage';

const mocks = vi.hoisted(() => ({
  push: vi.fn<(path: string) => void>(),
  pathname: vi.fn<() => string>(),
  locale: vi.fn<() => string>(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname(),
  // Real implementation uses router.push (not replace) — verified in
  // src/components/ui/selectLanguage.tsx:35.
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock('next-intl', () => ({
  useLocale: () => mocks.locale(),
  useTranslations: () => (key: string) => `sidebar.${key}`,
}));

beforeEach(() => {
  mocks.push.mockReset();
});

const TRIGGER_ES = 'sidebar.language.default (ES)';
const TRIGGER_EN = 'sidebar.language.default (EN)';

describe('SelectLanguage', () => {
  it('shows the current locale in a keyboard-operable trigger button', () => {
    mocks.locale.mockReturnValue('es');
    mocks.pathname.mockReturnValue('/es/dashboard');
    render(<SelectLanguage />);
    // The trigger is a real <button> (a11y fix) — assertable by role + name.
    expect(screen.getByRole('button', { name: TRIGGER_ES })).toBeInTheDocument();
  });

  it('pushes the pathname with the new locale prefix when switching to English', async () => {
    mocks.locale.mockReturnValue('es');
    mocks.pathname.mockReturnValue('/es/dashboard');
    const user = userEvent.setup();
    render(<SelectLanguage />);
    await user.click(screen.getByRole('button', { name: TRIGGER_ES }));
    await user.click(await screen.findByRole('menuitem', { name: 'sidebar.language.en' }));
    expect(mocks.push).toHaveBeenCalledWith('/en/dashboard');
  });

  it('does not navigate when the selected locale equals the current one', async () => {
    mocks.locale.mockReturnValue('es');
    mocks.pathname.mockReturnValue('/es/dashboard');
    const user = userEvent.setup();
    render(<SelectLanguage />);
    await user.click(screen.getByRole('button', { name: TRIGGER_ES }));
    await user.click(await screen.findByRole('menuitem', { name: 'sidebar.language.es' }));
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it('switches from English back to Spanish', async () => {
    mocks.locale.mockReturnValue('en');
    mocks.pathname.mockReturnValue('/en/dashboard');
    const user = userEvent.setup();
    render(<SelectLanguage />);
    await user.click(screen.getByRole('button', { name: TRIGGER_EN }));
    await user.click(await screen.findByRole('menuitem', { name: 'sidebar.language.es' }));
    expect(mocks.push).toHaveBeenCalledWith('/es/dashboard');
  });

  describe('locale prefix handling (regression tests for the anchored-regex fix)', () => {
    // Post-fix behavior (src/components/ui/selectLanguage.tsx:30-33): the
    // pathname is rewritten only when the current locale is the INITIAL
    // prefix; otherwise the new locale is prepended. These cases failed
    // against the old loose `pathname.replace('/' + currentLocale, ...)`:
    // it no-opped on prefix-less paths and corrupted mid-path segments.

    it('prepends the new locale when the pathname has no locale prefix', async () => {
      mocks.locale.mockReturnValue('es');
      mocks.pathname.mockReturnValue('/dashboard');
      const user = userEvent.setup();
      render(<SelectLanguage />);
      await user.click(screen.getByRole('button', { name: TRIGGER_ES }));
      await user.click(await screen.findByRole('menuitem', { name: 'sidebar.language.en' }));
      // Old bug: no '/es' match → pushed '/dashboard' unchanged (silent no-op).
      expect(mocks.push).toHaveBeenCalledWith('/en/dashboard');
    });

    it('does not rewrite a locale-like segment in the middle of the path', async () => {
      mocks.locale.mockReturnValue('es');
      mocks.pathname.mockReturnValue('/settings/es');
      const user = userEvent.setup();
      render(<SelectLanguage />);
      await user.click(screen.getByRole('button', { name: TRIGGER_ES }));
      await user.click(await screen.findByRole('menuitem', { name: 'sidebar.language.en' }));
      // Old bug: the loose replace turned the trailing '/es' into '/en' →
      // '/settings/en' (mid-path corruption). The anchored regex only touches
      // the initial prefix, so '/settings/es' is preserved and '/en' prepended.
      expect(mocks.push).toHaveBeenCalledWith('/en/settings/es');
    });

    it('rewrites the initial prefix when the pathname is exactly the locale root', async () => {
      mocks.locale.mockReturnValue('en');
      mocks.pathname.mockReturnValue('/en');
      const user = userEvent.setup();
      render(<SelectLanguage />);
      await user.click(screen.getByRole('button', { name: TRIGGER_EN }));
      await user.click(await screen.findByRole('menuitem', { name: 'sidebar.language.es' }));
      expect(mocks.push).toHaveBeenCalledWith('/es');
    });
  });
});