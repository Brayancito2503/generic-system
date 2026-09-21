/**
 * Currency utilities for multi-tenant dynamic currency formatting and conversion.
 */

export interface TenantSettingsCurrency {
  currency?: string;
  currencySymbol?: string;
  secondaryCurrency?: string;
  exchangeRate?: number;
}

/**
 * Formats a numeric amount using the tenant's configured currency symbol (or 'C$' default).
 */
export function formatCurrency(
  amount: number,
  settings?: TenantSettingsCurrency | null
): string {
  const symbol = settings?.currencySymbol?.trim() || 'C$';
  const val = Number.isNaN(amount) ? 0 : amount;
  const numStr = val.toLocaleString('es-NI', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol} ${numStr}`;
}

/**
 * Formats an amount in equivalent secondary currency using the configured exchange rate.
 * Returns null if no valid positive exchange rate is set.
 */
export function formatSecondaryCurrency(
  amount: number,
  exchangeRate?: number,
  secondaryCurrency?: string
): string | null {
  if (!exchangeRate || exchangeRate <= 0) return null;
  const converted = amount / exchangeRate;
  const code = secondaryCurrency?.trim() || 'USD';
  const symbol = code === 'USD' ? '$' : code;
  const numStr = converted.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${code} ${symbol}${numStr}`;
}
