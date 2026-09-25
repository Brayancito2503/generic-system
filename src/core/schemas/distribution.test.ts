import { describe, expect, it } from 'vitest';
import {
  createCountBatchSchema,
  createInventoryAdjustmentSchema,
  createInventoryItemSchema,
  createSaleReturnSchema,
  inventoryListQuerySchema,
  purchaseOrderItemSchema,
  receivePurchaseOrderSchema,
  registerSaleSchema,
  saleReturnItemSchema,
} from './distribution';

// Fase 2 Slice A contract: every quantity carrying units admits at most two
// decimals. These schema-level tests pin the message routes return on bad
// input and the valid fractions every flow now accepts.
const MAX_2DP = 'Máximo 2 decimales';

describe('fractional quantity contract (2 decimals max)', () => {
  it('registerSaleSchema accepts a 2.5-unit line and rejects 3 decimals', () => {
    const ok = registerSaleSchema.safeParse({
      lines: [{ itemId: 'item_1', quantity: 2.5 }],
      discount: 0,
      paymentMethod: 'CASH',
      paidAmount: 100,
      userId: 'user_1',
    });
    expect(ok.success).toBe(true);

    const bad = registerSaleSchema.safeParse({
      lines: [{ itemId: 'item_1', quantity: 3.333 }],
      discount: 0,
      paymentMethod: 'CASH',
      userId: 'user_1',
    });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues.some((i) => i.message === MAX_2DP)).toBe(true);
    }
  });

  it('purchaseOrderItemSchema accepts 10.5 and rejects 0.001', () => {
    expect(
      purchaseOrderItemSchema.safeParse({ itemId: 'item_1', quantity: 10.5 }).success
    ).toBe(true);

    const bad = purchaseOrderItemSchema.safeParse({ itemId: 'item_1', quantity: 0.001 });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues.some((i) => i.message === MAX_2DP)).toBe(true);
    }
  });

  it('receivePurchaseOrderSchema accepts a fractional receive', () => {
    expect(
      receivePurchaseOrderSchema.safeParse({
        receivedItems: [{ itemId: 'item_1', quantity: 3.75 }],
        userId: 'user_1',
      }).success
    ).toBe(true);
  });

  it('saleReturnItemSchema accepts a fractional return and rejects 3 decimals', () => {
    expect(
      saleReturnItemSchema.safeParse({ itemId: 'item_1', quantity: 1.5 }).success
    ).toBe(true);

    const bad = saleReturnItemSchema.safeParse({ itemId: 'item_1', quantity: 1.505 });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues.some((i) => i.message === MAX_2DP)).toBe(true);
    }
  });

  it('createSaleReturnSchema accepts 2.5 units', () => {
    expect(
      createSaleReturnSchema.safeParse({
        items: [{ itemId: 'item_1', quantity: 2.5 }],
        userId: 'user_1',
        reason: 'CLIENTE_DEVUELVE',
      }).success
    ).toBe(true);
  });

  it('createInventoryItemSchema: fractional opening stock passes, 3 decimals and fractional minAlert fail', () => {
    const ok = createInventoryItemSchema.safeParse({
      name: 'Arroz 25lb',
      cost: 30,
      price: 40,
      stock: 2.5,
      minAlert: 5,
    });
    expect(ok.success).toBe(true);

    const badStock = createInventoryItemSchema.safeParse({
      name: 'Arroz 25lb',
      cost: 30,
      price: 40,
      stock: 2.555,
      minAlert: 5,
    });
    expect(badStock.success).toBe(false);
    if (!badStock.success) {
      expect(badStock.error.issues.some((i) => i.message === MAX_2DP)).toBe(true);
    }

    // minAlert stays an integer threshold (DB column is Int).
    expect(
      createInventoryItemSchema.safeParse({
        name: 'Arroz 25lb',
        cost: 30,
        price: 40,
        stock: 0,
        minAlert: 2.5,
      }).success
    ).toBe(false);
  });

  it('createInventoryAdjustmentSchema: signed 1.5 ok, 2.5-3 decimals rejected, zero rejected', () => {
    expect(
      createInventoryAdjustmentSchema.safeParse({
        branchId: 'branch-1',
        itemId: 'item_1',
        quantity: 1.5,
        reason: 'SOBRANTE',
        userId: 'user_1',
      }).success
    ).toBe(true);

    const bad = createInventoryAdjustmentSchema.safeParse({
      branchId: 'branch-1',
      itemId: 'item_1',
      quantity: 2.555,
      reason: 'SOBRANTE',
      userId: 'user_1',
    });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues.some((i) => i.message === MAX_2DP)).toBe(true);
    }

    expect(
      createInventoryAdjustmentSchema.safeParse({
        branchId: 'branch-1',
        itemId: 'item_1',
        quantity: 0,
        reason: 'SOBRANTE',
        userId: 'user_1',
      }).success
    ).toBe(false);
  });

  it('createCountBatchSchema: countedQuantity 2.5 ok, 3 decimals rejected', () => {
    expect(
      createCountBatchSchema.safeParse({
        branchId: 'branch-1',
        items: [{ itemId: 'item_1', countedQuantity: 2.5 }],
        userId: 'user_1',
      }).success
    ).toBe(true);

    const bad = createCountBatchSchema.safeParse({
      branchId: 'branch-1',
      items: [{ itemId: 'item_1', countedQuantity: 2.505 }],
      userId: 'user_1',
    });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues.some((i) => i.message === MAX_2DP)).toBe(true);
    }
  });
});

describe('inventoryListQuerySchema: closed sort enum (Fase 2 Slice C)', () => {
  it('defaults to the historical alphabetical order when no sort is sent', () => {
    const parsed = inventoryListQuerySchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.sort).toBe('name');
  });

  it('accepts exactly the two supported orders', () => {
    for (const sort of ['name', 'velocity'] as const) {
      const parsed = inventoryListQuerySchema.safeParse({ sort });
      expect(parsed.success).toBe(true);
      if (parsed.success) expect(parsed.data.sort).toBe(sort);
    }
  });

  it('rejects any other sort value (no free-form orderBy escape hatch)', () => {
    for (const sort of ['stock', 'NAME', 'velocity; drop table', '']) {
      expect(inventoryListQuerySchema.safeParse({ sort }).success).toBe(false);
    }
  });

  it('stays strict: an extra query param is still rejected (was noQueryParamsSchema)', () => {
    expect(
      inventoryListQuerySchema.safeParse({ sort: 'name', orderBy: 'stock' }).success
    ).toBe(false);
    // tenantId is server-derived; a client-supplied one has no place in the query.
    expect(inventoryListQuerySchema.safeParse({ tenantId: 'tenant-2' }).success).toBe(false);
  });
});