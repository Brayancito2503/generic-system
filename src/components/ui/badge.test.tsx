// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { Badge } from './badge';

type BadgeVariant = NonNullable<ComponentProps<typeof Badge>['variant']>;

describe('Badge', () => {
  it('renders with the default variant', () => {
    render(<Badge>New</Badge>);
    const badge = screen.getByText('New');
    expect(badge.className).toContain('inline-flex items-center rounded-full');
    expect(badge.className).toContain('bg-primary');
  });

  it.each<[BadgeVariant, string]>([
    ['default', 'bg-primary'],
    ['secondary', 'bg-secondary'],
    ['destructive', 'bg-destructive'],
    ['outline', 'text-foreground'],
  ])('applies the %s variant class', (variant, expectedClass) => {
    render(<Badge variant={variant}>{variant}</Badge>);
    expect(screen.getByText(variant).className).toContain(expectedClass);
  });

  it('renders children and merges a custom className', () => {
    render(<Badge className="my-custom-badge">Label</Badge>);
    const badge = screen.getByText('Label');
    expect(badge.className).toContain('my-custom-badge');
    expect(badge.className).toContain('bg-primary');
  });
});