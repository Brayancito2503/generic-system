// Distribution vertical — Zod input schemas (Core, agnóstico a infraestructura)
// Every api/distribution/** body and query is validated against these contracts;
// money math and tenantId stay server-side. No `any` anywhere.

import { z } from 'zod';
import { hasAnyDefinedField } from './tenant';

const idString = z.string().trim().min(1).max(60);
const nullableText = z.string().trim().max(500).nullish();

/** Path-param contract for `[id]` routes. */
export const idParamSchema = idString;
const nonNegativeNumber = z.number().finite().nonnegative();

// Fase 2 Slice A: every quantity carrying units (sales, PO create/receive,
// returns, initial stock) is bounded to two decimals so the kardex, Inventory
// .stock and the line columns never disagree on the ledger value.
const quantity2dp = (v: number) => Math.round(v * 100) / 100 === v;
const quantity2dpPositive = z
  .number()
  .finite()
  .positive()
  .refine(quantity2dp, 'Máximo 2 decimales');
const quantity2dpNonNegative = z
  .number()
  .finite()
  .nonnegative()
  .refine(quantity2dp, 'Máximo 2 decimales');

/** Accepts optional emails that may arrive as '' from legacy forms. */
const nullableEmail = z
  .string()
  .trim()
  .max(200)
  .refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Correo inválido')
  .nullish();

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export const createCustomerSchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120),
  documentId: nullableText,
  email: nullableEmail,
  phone: nullableText,
});

export const updateCustomerSchema = createCustomerSchema
  .partial()
  .refine(hasAnyDefinedField, { message: 'No hay campos válidos para actualizar' });

// ---------------------------------------------------------------------------
// Purchase orders (+ receive)
// ---------------------------------------------------------------------------

export const purchaseOrderItemSchema = z.object({
  itemId: idString,
  quantity: quantity2dpPositive,
});

export const createPurchaseOrderSchema = z.object({
  supplierId: idString,
  branchId: idString,
  items: z.array(purchaseOrderItemSchema).min(1),
  notes: nullableText,
  expectedDate: z.coerce.date().optional(),
});

export const receivePurchaseOrderSchema = z.object({
  receivedItems: z
    .array(
      z.object({
        itemId: idString,
        // `quantity` must respect 0 < qty <= remaining; the repo enforces the
        // upper bound against the still-pending PO quantity (409 when exceeded).
        quantity: quantity2dpPositive,
      })
    )
    .min(1),
});

// ---------------------------------------------------------------------------
// Employees (POS PIN optional on create; hashed server-side on User link)
// ---------------------------------------------------------------------------

export const createEmployeeSchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120),
  email: nullableEmail,
  phone: nullableText,
  branchId: nullableText,
  role: z.string().trim().min(1).max(80).default('Vendedor'),
  // Access profile that drives route guards and UI gating; absent = legacy
  // full access (the "Vendedor" free-text role above is the job title, not
  // the permission profile).
  accessRole: z.enum(['CASHIER', 'ACCOUNTANT', 'MANAGER']).optional(),
  department: nullableText,
  salary: nonNegativeNumber.nullish(),
  commissionRate: z.number().finite().min(0).max(100).nullish(),
  hireDate: z.coerce.date().optional(),
  pin: z
    .string()
    .regex(/^\d{4,6}$/, 'PIN inválido')
    .optional(),
});

export const updateEmployeeSchema = createEmployeeSchema
  .extend({
    isActive: z.boolean().optional(),
  })
  .partial()
  .refine(hasAnyDefinedField, { message: 'No hay campos válidos para actualizar' });

// ---------------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------------

export const createSupplierSchema = z.object({
  name: z.string().trim().min(1).max(200),
  contactName: nullableText,
  phone: nullableText,
  email: nullableEmail,
  taxId: nullableText,
  address: nullableText,
});

/**
 * Edición + desactivación de proveedores. A diferencia del create, `isActive`
 * es PATCHeable: `isActive: false` desactiva sin tocar las órdenes de compra
 * existentes (el create de PO ya rechaza proveedores inactivos en el servidor).
 * `null` limpia los campos de contacto nullable; `undefined` los deja intactos.
 */
export const updateSupplierSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    contactName: nullableText,
    phone: nullableText,
    email: nullableEmail,
    taxId: nullableText,
    address: nullableText,
    isActive: z.boolean().optional(),
  })
  .refine(hasAnyDefinedField, { message: 'No hay campos válidos para actualizar' });

// ---------------------------------------------------------------------------
// Inventory ops (branchId-scoped updates + negative-value guards)
// ---------------------------------------------------------------------------

export const createInventoryItemSchema = z.object({
  sku: z.string().trim().max(60).optional(),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(500).optional(),
  cost: nonNegativeNumber,
  price: nonNegativeNumber,
  // Fractional opening stock allowed (Fase 2 Slice A) — an alta can open with
  // 2.5 units; the INITIAL ledger row and Inventory.stock share the same value.
  stock: quantity2dpNonNegative.default(0),
  // minAlert stays an integer threshold (the DB column is Int).
  minAlert: z.number().int().nonnegative().default(5),
});

export const updateInventoryItemSchema = z
  .object({
    sku: z.string().trim().max(60).optional(),
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(500).optional(),
    cost: nonNegativeNumber.optional(),
    price: nonNegativeNumber.optional(),
    // `stock` stays parseable so old clients fail LOUDLY at the route (400
    // 'El stock solo se ajusta mediante movimientos de inventario') instead of
    // silently losing the field; the repository double-guards it too.
    stock: quantity2dpNonNegative.optional(),
    minAlert: z.number().int().nonnegative().optional(),
    branchId: idString.optional(),
  })
  .refine(hasAnyDefinedField, { message: 'No hay campos válidos para actualizar' });

// ---------------------------------------------------------------------------
// Sales (paymentMethod / paidAmount / balance for P1; money math server-side)
// ---------------------------------------------------------------------------

export const saleLineSchema = z.object({
  itemId: idString,
  quantity: quantity2dpPositive,
});

export const registerSaleSchema = z.object({
  lines: z.array(saleLineSchema).min(1),
  discount: nonNegativeNumber.default(0),
  personId: nullableText,
  notes: nullableText,
  paymentMethod: z.enum(['CASH', 'CARD', 'TRANSFER', 'CREDIT']).default('CASH'),
  // Only the tendered amount is client input; `balance` is derived server-side
  // (total − paidAmount) inside the sale transaction and never accepted here.
  paidAmount: nonNegativeNumber.optional(),
});

/** List query for `GET /sales`: paginated, tenant-scoped (limit 1..100; out-of-range pages → empty). */
export const salesListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Daily close report query: requires a strict `YYYY-MM-DD` that also exists on
 * the calendar (2026-02-31 rolls over and fails the day-match refine).
 */
export const dailyCloseQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido')
    .refine((v) => {
      const d = new Date(`${v}T00:00:00Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
    }, 'Fecha inválida'),
});

// ---------------------------------------------------------------------------
// Inventory ledger (kardex): adjustments, movements and physical count (F0/F1)
// ---------------------------------------------------------------------------

/** Reasons of a manual adjustment; sign convention enforced server-side. */
export const inventoryAdjustmentReasonSchema = z.enum([
  'MERMA',
  'ROTURA',
  'VENCIMIENTO',
  'DESCUADRE',
  'SOBRANTE',
]);

/**
 * Manual adjustment: `quantity` is signed per the ledger convention (negative
 * for losses, positive for SOBRANTE) and must be nonzero. The repository
 * cross-checks the sign against `reason` (400) and the resulting stock (409).
 */
export const createInventoryAdjustmentSchema = z.object({
  branchId: idString,
  itemId: idString,
  // Signed per the ledger convention; 2dp-aligned with every other quantity.
  quantity: z
    .number()
    .finite()
    .refine((v) => v !== 0, 'La cantidad no puede ser cero')
    .refine((v) => Math.round(v * 100) / 100 === v, 'Máximo 2 decimales'),
  reason: inventoryAdjustmentReasonSchema,
  notes: z.string().trim().max(500).nullish(),
});

/** Strict optional YYYY-MM-DD for the ledger date-window filters. */
const optionalStrictDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido')
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, 'Fecha inválida')
  .optional();

/** Ledger list query: tenant-scoped filters (branch/item/type/reason/from/to). */
export const listMovementsQuerySchema = z.object({
  branchId: idString.optional(),
  itemId: idString.optional(),
  type: z
    .enum([
      'INITIAL',
      'RECEIVE',
      'SALE',
      'RETURN',
      'ADJUSTMENT',
      'TRANSFER_OUT',
      'TRANSFER_IN',
    ])
    .optional(),
  reason: inventoryAdjustmentReasonSchema.optional(),
  from: optionalStrictDate,
  to: optionalStrictDate,
});

/** Physical-count batch: countedQuantity ≥ 0 per item, 2dp (fractions allowed). */
export const createCountBatchSchema = z.object({
  branchId: idString,
  items: z
    .array(
      z.object({
        itemId: idString,
        countedQuantity: quantity2dpNonNegative,
      })
    )
    .min(1),
});

// ---------------------------------------------------------------------------
// Returns (P1): audited refunds/voids that restore stock. The repo rejects an
// over-return (refunded qty > sold qty) with 409 and adjusts the receivable
// balance of the original credit sale; all money math is server-side.
// ---------------------------------------------------------------------------

export const saleReturnItemSchema = z.object({
  itemId: idString,
  quantity: quantity2dpPositive,
});

export const createSaleReturnSchema = z.object({
  items: z.array(saleReturnItemSchema).min(1),
  reason: nullableText,
});

/** List query for `GET /returns`: tenant-scoped, paginated (same contract as sales/receivables). */
export const saleReturnsListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** List query for `GET /receivables`: tenant-scoped, paginated, optional status filter. */
export const receivablesListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['OPEN', 'PARTIAL', 'PAID']).optional(),
});

/** Payment on a receivable: amount must be > 0 (repo enforces it against the remaining balance). */
export const payReceivableSchema = z.object({
  amount: z.number().finite().positive(),
  // Credit is never a settlement method; receivables are paid CASH/CARD/TRANSFER.
  method: z.enum(['CASH', 'CARD', 'TRANSFER']).default('CASH'),
});

// ---------------------------------------------------------------------------
// Cash register
// ---------------------------------------------------------------------------

export const openCashSessionSchema = z.object({
  branchId: idString.optional(),
  openingAmount: nonNegativeNumber,
  employeeId: nullableText,
});

export const addCashMovementSchema = z.object({
  sessionId: idString,
  type: z.enum(['IN', 'OUT']),
  amount: z.number().finite().positive(),
  concept: z.string().trim().min(1).max(200),
});

export const closeCashSessionSchema = z.object({
  sessionId: idString,
  // Only the physical count is client input; expected/difference are computed server-side.
  physicalCount: nonNegativeNumber,
});

// ---------------------------------------------------------------------------
// Tax rates
// ---------------------------------------------------------------------------

export const createTaxRateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  rate: z.number().finite().min(0).max(100),
  isInclusive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
});

export const updateTaxRateSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    rate: z.number().finite().min(0).max(100).optional(),
    isInclusive: z.boolean().optional(),
    isActive: z.boolean().optional(),
    isDefault: z.boolean().optional(),
  })
  .refine(hasAnyDefinedField, { message: 'No hay campos válidos para actualizar' });

// ---------------------------------------------------------------------------
// Invoicing / CAI config (persisted server-side; route lands in P0)
// ---------------------------------------------------------------------------

export const invoicingConfigSchema = z.object({
  caiNumber: z.string().trim().min(1).max(40),
  rangeFrom: z.string().trim().min(1).max(20),
  rangeTo: z.string().trim().min(1).max(20),
  limitDate: z.coerce.date().optional(),
  companyTaxId: z.string().trim().min(1).max(40),
  legalName: z.string().trim().min(1).max(200),
});