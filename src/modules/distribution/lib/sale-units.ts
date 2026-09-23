import type { ItemSaleUnit } from '../entities';

/**
 * Per-sale-unit display helpers (Fase 2 Slice B).
 * UNIDAD = legacy piece-based behavior: no suffix anywhere.
 * LIBRA/KILOGRAMO map to language-neutral literals ('lb'/'kg') through the
 * i18n `saleUnits.*` keys — identically translated in es and en.
 */

const SALE_UNIT_KEYS: Record<ItemSaleUnit, string> = {
  UNIDAD: 'saleUnits.UNIDAD',
  LIBRA: 'saleUnits.LIBRA',
  KILOGRAMO: 'saleUnits.KILOGRAMO',
};

type Translate = (key: string) => string;

/** Quantity/price suffix for weight items ('lb'/'kg'); null for piece-based. */
export function saleUnitSuffix(
  saleUnit: ItemSaleUnit | null | undefined,
  t: Translate
): string | null {
  if (!saleUnit || saleUnit === 'UNIDAD') return null;
  return t(SALE_UNIT_KEYS[saleUnit]);
}