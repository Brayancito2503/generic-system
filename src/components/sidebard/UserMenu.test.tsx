// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserMenu from './UserMenu';

describe('UserMenu', () => {
  it('shows the user name, email and a menu trigger when the sidebar is open', () => {
    render(<UserMenu isSidebarOpen />);
    expect(screen.getByText('Yovany Luis')).toBeInTheDocument();
    expect(screen.getByText('yovany.lg@gmail.com')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('renders a compact avatar-only trigger when the sidebar is closed', () => {
    render(<UserMenu isSidebarOpen={false} />);
    expect(screen.queryByText('Yovany Luis')).not.toBeInTheDocument();
    expect(screen.queryByText('yovany.lg@gmail.com')).not.toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('opens the dropdown with the account actions (open sidebar)', async () => {
    const user = userEvent.setup();
    render(<UserMenu isSidebarOpen />);
    await user.click(screen.getByRole('button'));
    expect(screen.getByText('My Account')).toBeInTheDocument();
    await expect(screen.findByRole('menuitem', { name: 'Settings' })).resolves.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Support' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Logout' })).toBeInTheDocument();
  });

  it('opens the dropdown from the collapsed trigger too', async () => {
    const user = userEvent.setup();
    render(<UserMenu isSidebarOpen={false} />);
    await user.click(screen.getByRole('button'));
    await expect(screen.findByRole('menuitem', { name: 'Logout' })).resolves.toBeInTheDocument();
  });

  it('keeps the account actions inert and closes the dropdown after selecting an item', async () => {
    // Real behavior: Settings/Support/Logout have NO onClick in
    // src/components/sidebard/UserMenu.tsx (lines 54-57), so clicking one only
    // selects AND closes the Radix menu — observable: no menuitem remains in
    // the DOM and no error is thrown.
    const user = userEvent.setup();
    render(<UserMenu isSidebarOpen />);
    await user.click(screen.getByRole('button'));
    await user.click(await screen.findByRole('menuitem', { name: 'Logout' }));
    expect(screen.queryByRole('menuitem')).toBeNull();
    expect(screen.getByText('Yovany Luis')).toBeInTheDocument();
  });
});