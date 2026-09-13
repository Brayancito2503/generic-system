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
  quantity: z.number().int().positive(),
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
        quantity: z.number().int().positive(),
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

export const updateSupplierSchema = createSupplierSchema
  .partial()
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
  stock: z.number().int().nonnegative().default(0),
  minAlert: z.number().int().nonnegative().default(5),
});

export const updateInventoryItemSchema = z
  .object({
    sku: z.string().trim().max(60).optional(),
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(500).optional(),
    cost: nonNegativeNumber.optional(),
    price: nonNegativeNumber.optional(),
    stock: z.number().int().nonnegative().optional(),
    minAlert: z.number().int().nonnegative().optional(),
    branchId: idString.optional(),
  })
  .refine(hasAnyDefinedField, { message: 'No hay campos válidos para actualizar' });

// ---------------------------------------------------------------------------
// Sales (paymentMethod / paidAmount / balance for P1; money math server-side)
// ---------------------------------------------------------------------------

export const saleLineSchema = z.object({
  itemId: idString,
  quantity: z.number().int().positive(),
});

export const registerSaleSchema = z.object({
  lines: z.array(saleLineSchema).min(1),
  discount: nonNegativeNumber.default(0),
  personId: nullableText,
  notes: nullableText,
  paymentMethod: z.enum(['CASH', 'CARD', 'TRANSFER', 'CREDIT']).default('CASH'),
  paidAmount: nonNegativeNumber.optional(),
  balance: nonNegativeNumber.optional(),
});

/** Legacy list query: `limit` cap keeps the current `take 500` contract; pagination lands in P1. */
export const salesListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
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