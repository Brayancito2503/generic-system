export interface ItemAttributes {
  durationDays?: number; // Para servicios tipo membresías
  accessZones?: string[];
  category?: string;
  brand?: string;
  [key: string]: unknown;
}

export interface ItemEntity {
  id: string;
  tenantId: string;
  sku?: string | null;
  name: string;
  description?: string | null;
  cost: number;
  price: number;
  isService: boolean;
  /** Sale unit (Fase 2 Slice B); null/UNIDAD = legacy piece-based. */
  saleUnit?: 'UNIDAD' | 'LIBRA' | 'KILOGRAMO' | null;
  attributes: ItemAttributes;
  createdAt: Date;
}
