// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from './avatar';

/**
 * Radix AvatarImage only renders the <img> once the image is loaded
 * (@radix-ui/react-avatar: `imageLoadingStatus === "loaded" ? <img> : null`).
 * jsdom never loads images, so we stub window.Image: the default stub stands
 * in for an already-loaded image (exercises the img rendering path) and the
 * failing-image test overrides it with `naturalWidth: 0` (exercises the
 * fallback path). Radix resolves the status synchronously from
 * `image.complete && image.naturalWidth > 0` — no async load/error events are
 * relied on.
 */
class FakeImage {
  complete = true;
  naturalWidth = 100;
  naturalHeight = 100;
  src = '';
  addEventListener(): void {}
  removeEventListener(): void {}
}

beforeEach(() => {
  vi.stubGlobal('Image', FakeImage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Avatar', () => {
  it('renders with default size', () => {
    render(<Avatar />);
    expect(document.querySelector('[data-slot="avatar"]')).toHaveAttribute(
      'data-size',
      'default'
    );
  });

  it.each(['sm', 'lg'] as const)('applies the %s size', (size) => {
    render(<Avatar size={size} />);
    expect(document.querySelector('[data-slot="avatar"]')).toHaveAttribute(
      'data-size',
      size
    );
  });

  it('merges a custom className', () => {
    render(<Avatar className="rounded-xl" />);
    expect(document.querySelector('[data-slot="avatar"]')?.className).toContain('rounded-xl');
  });
});

describe('AvatarImage and AvatarFallback', () => {
  it('renders the image with src and alt', () => {
    render(
      <Avatar>
        <AvatarImage src="/me.png" alt="Mi foto" />
      </Avatar>
    );
    const img = screen.getByAltText('Mi foto');
    expect(img).toHaveAttribute('src', '/me.png');
    expect(img).toHaveAttribute('data-slot', 'avatar-image');
  });

  it('shows the fallback when no image source is provided', () => {
    render(
      <Avatar>
        <AvatarFallback>YL</AvatarFallback>
      </Avatar>
    );
    const fallback = screen.getByText('YL');
    expect(fallback).toBeInTheDocument();
    expect(fallback).toHaveAttribute('data-slot', 'avatar-fallback');
  });

  it('shows the fallback when the image has not loaded', () => {
    // Same shape as FakeImage but `naturalWidth: 0` — Radix resolves the
    // status to "loading" (not "loaded"), so the <img> never mounts and the
    // fallback takes its place.
    const BrokenImage = class {
      complete = true;
      naturalWidth = 0;
      naturalHeight = 0;
      src = '';
      addEventListener(): void {}
      removeEventListener(): void {}
    };
    vi.stubGlobal('Image', BrokenImage);

    render(
      <Avatar>
        <AvatarImage src="/broken.png" alt="Mi foto" />
        <AvatarFallback>YL</AvatarFallback>
      </Avatar>
    );

    expect(screen.queryByAltText('Mi foto')).toBeNull();
    const fallback = screen.getByText('YL');
    expect(fallback).toBeInTheDocument();
    expect(fallback).toHaveAttribute('data-slot', 'avatar-fallback');
  });
});

describe('AvatarGroup', () => {
  it('renders group, badge and count slots', () => {
    render(
      <AvatarGroup>
        <Avatar>
          <AvatarBadge>
            <span>+2</span>
          </AvatarBadge>
        </Avatar>
        <AvatarGroupCount>3</AvatarGroupCount>
      </AvatarGroup>
    );
    expect(document.querySelector('[data-slot="avatar-group"]')).toHaveTextContent('3');
    expect(document.querySelector('[data-slot="avatar-badge"]')).toHaveTextContent('+2');
    expect(document.querySelector('[data-slot="avatar-group-count"]')).toHaveTextContent('3');
  });
});