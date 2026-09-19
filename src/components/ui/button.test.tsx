// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { Button } from './button';

type ButtonVariant = NonNullable<ComponentProps<typeof Button>['variant']>;
type ButtonSize = NonNullable<ComponentProps<typeof Button>['size']>;

describe('Button', () => {
  it('renders with default variant/size attributes and base styles', () => {
    render(<Button>Submit</Button>);
    const button = screen.getByRole('button', { name: 'Submit' });
    expect(button).toHaveAttribute('data-slot', 'button');
    expect(button).toHaveAttribute('data-variant', 'default');
    expect(button).toHaveAttribute('data-size', 'default');
    expect(button.className).toContain('bg-primary');
  });

  it.each<[ButtonVariant, string]>([
    ['default', 'bg-primary'],
    ['secondary', 'bg-secondary'],
    ['destructive', 'text-destructive'],
    ['outline', 'border-border'],
    ['ghost', 'hover:bg-muted'],
    ['link', 'underline-offset-4'],
  ])('applies the %s variant class', (variant, expectedClass) => {
    render(<Button variant={variant}>{variant}</Button>);
    expect(screen.getByRole('button', { name: variant }).className).toContain(expectedClass);
  });

  it.each<[ButtonSize, string]>([
    ['default', 'h-8'],
    ['xs', 'h-6'],
    ['sm', 'h-7'],
    ['lg', 'h-9'],
    ['icon', 'size-8'],
    ['icon-sm', 'size-7'],
    ['icon-lg', 'size-9'],
  ])('applies the %s size class and data-size attribute', (size, expectedClass) => {
    render(<Button size={size}>{size}</Button>);
    const button = screen.getByRole('button', { name: size });
    expect(button).toHaveAttribute('data-size', size);
    expect(button.className).toContain(expectedClass);
  });

  it('merges a custom className with the base styles and renders children', () => {
    render(
      <Button className="my-custom-class">
        <span>Child</span>
      </Button>
    );
    const button = screen.getByRole('button');
    expect(button.className).toContain('my-custom-class');
    expect(button.className).toContain('bg-primary');
    expect(screen.getByText('Child')).toBeInTheDocument();
  });

  it('fires onClick when enabled and does not fire it when disabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await user.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).toHaveBeenCalledTimes(1);

    const { unmount } = render(
      <Button onClick={onClick} disabled>
        Go
      </Button>
    );
    const disabled = screen.getAllByRole('button', { name: 'Go' })[1];
    expect(disabled).toBeDisabled();
    await user.click(disabled);
    expect(onClick).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('renders the child element when asChild is used (Slot)', () => {
    render(
      <Button asChild>
        <a href="https://example.com">Log in</a>
      </Button>
    );
    const link = screen.getByRole('link', { name: 'Log in' });
    expect(link).toHaveAttribute('data-slot', 'button');
    expect(link.className).toContain('bg-primary');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});