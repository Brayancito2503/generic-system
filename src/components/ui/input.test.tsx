// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from './input';

describe('Input', () => {
  it('renders an input with the input data-slot and defaults to type text', () => {
    render(<Input />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('data-slot', 'input');
    expect(input).toHaveProperty('type', 'text');
  });

  it('forwards standard input attributes', () => {
    render(<Input placeholder="Search…" aria-invalid="true" aria-label="Buscar" />);
    const input = screen.getByRole('textbox', { name: 'Buscar' });
    expect(input).toHaveAttribute('placeholder', 'Search…');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('respects the type prop', () => {
    render(<Input type="password" aria-label="Clave" />);
    // Password inputs are not exposed as role textbox — query by label.
    expect(screen.getByLabelText('Clave')).toHaveProperty('type', 'password');
  });

  it('handles typing via onChange and updates the value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Input aria-label="Nombre" onChange={onChange} />);
    const input = screen.getByRole('textbox', { name: 'Nombre' });
    await user.type(input, 'Ana');
    expect(input).toHaveValue('Ana');
    expect(onChange).toHaveBeenCalled();
  });

  it('blocks typing when disabled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Input aria-label="Bloqueado" disabled onChange={onChange} />);
    const input = screen.getByRole('textbox', { name: 'Bloqueado' });
    expect(input).toBeDisabled();
    await user.type(input, 'x');
    expect(input).toHaveValue('');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('merges a custom className', () => {
    render(<Input aria-label="Clase" className="my-input-class" />);
    expect(screen.getByRole('textbox', { name: 'Clase' }).className).toContain(
      'my-input-class'
    );
  });
});