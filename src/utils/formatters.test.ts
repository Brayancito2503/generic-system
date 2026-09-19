// Pin the ICU timezone so date formatting is deterministic on any machine/CI.
process.env.TZ = 'UTC';

import { describe, expect, it } from 'vitest';
import { formatCurrency, formatDateToLocal } from './formatters';

// Intl may emit U+00A0 (NBSP), U+202F (narrow NBSP), or no separator before the
// currency symbol depending on the ICU version. Strip whitespace before
// comparing default-locale outputs.
const stripWhitespace = (value: string): string => value.replace(/\s/g, '');

describe('formatCurrency', () => {
  it('formats with explicit locale and currency', () => {
    expect(formatCurrency(1234.56, 'en-US', 'USD')).toBe('$1,234.56');
  });

  it('pads to two decimal places', () => {
    expect(formatCurrency(1234.5, 'en-US', 'USD')).toBe('$1,234.50');
  });

  it('formats zero', () => {
    expect(formatCurrency(0, 'en-US', 'USD')).toBe('$0.00');
  });

  it('rounds to two decimal places', () => {
    expect(formatCurrency(1234.567, 'en-US', 'USD')).toBe('$1,234.57');
  });

  it('formats large numbers with grouping separators', () => {
    expect(formatCurrency(1234567.89, 'en-US', 'USD')).toBe('$1,234,567.89');
  });

  it('defaults to Córdoba Oro (NIO) with es-NI locale', () => {
    expect(stripWhitespace(formatCurrency(1234.56))).toBe('C$1,234.56');
  });
});

describe('formatDateToLocal', () => {
  it('formats an ISO date with an explicit locale', () => {
    expect(formatDateToLocal('2026-09-17T00:00:00Z', 'en-US')).toBe('Sep 17, 2026');
  });

  it('formats using the default es-NI locale', () => {
    const output = formatDateToLocal('2026-09-17T00:00:00Z');
    expect(output).toContain('2026');
    expect(output).toContain('17');
  });

  it('throws on an unparseable date string (no guard in production code)', () => {
    expect(() => formatDateToLocal('not-a-date')).toThrow();
  });
});