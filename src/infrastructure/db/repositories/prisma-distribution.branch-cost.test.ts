import { describe, expect, it, beforeEach, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { PrismaDistributionRepository } from '@/infrastructure/db/repositories/prisma-distribution.repository';

// S2a + S2b — branch-scoped cost. The defect this suite exists for: receiving
// into one branch used to re-price the WHOLE tenant, because the weighted
// average at `receivePurchaseOrder` was computed from the tenant-wide
// `Item.cost` scalar and written straight back into it.
//
// The Prisma client is mocked at the db layer; `$transaction` runs the callback
// against a tx object sharing the same method mocks (same technique as
// prisma-distribution.fractional.test.ts). `itemBranchCost` is on the mock
// surface from the start so the test does not need to know whether the
// implementation is already wired.
const txMocks = vi.hoisted(() => ({
  // Reads
  itemFindFirst: vi.fn(),
  itemFindMany: vi.fn(),
  itemBranchCostFindFirst: vi.fn(),
  itemBranchCostFindMany: vi.fn(),
  itemBranchCostFindUnique: vi.fn(),
  inventoryFindFirst: vi.fn(),
  inventoryFindMany: vi.fn(),
  saleItemGroupBy: vi.fn(),
  purchaseOrderFindFirst: vi.fn(),
  supplierFindFirst: vi.fn(),
  branchFindFirst: vi.fn(),
  branchFindMany: vi.fn(),
  employeeFindFirst: vi.fn(),
  cashSessionFindFirst: vi.fn(),
  taxRateFindFirst: vi.fn(),
  userFindFirst: vi.fn(),
  personFindFirst: vi.fn(),
  purchaseOrderItemFindMany: vi.fn(),
  // Writes
  itemUpdate: vi.fn(),
  itemBranchCostUpsert: vi.fn(),
  inventoryUpdate: vi.fn(),
  inventoryUpdateMany: vi.fn(),
  inventoryMovementCreate: vi.fn(),
  purchaseOrderItemUpdateMany: vi.fn(),
  purchaseOrderUpdate: vi.fn(),
  purchaseOrderCreate: vi.fn(),
  purchaseOrderCount: vi.fn(),
  cashSessionUpdateMany: vi.fn(),
  saleCounterUpsert: vi.fn(),
  saleCreate: vi.fn(),
  receivableCreate: vi.fn(),
}));

vi.mock('@/infrastructure/db/prisma', () => {
  const tx = {
    item: { findFirst: txMocks.itemFindFirst, findMany: txMocks.itemFindMany, update: txMocks.itemUpdate },
    itemBranchCost: {
      findFirst: txMocks.itemBranchCostFindFirst,
      findMany: txMocks.itemBranchCostFindMany,
      findUnique: txMocks.itemBranchCostFindUnique,
      upsert: txMocks.itemBranchCostUpsert,
    },
    inventory: {
      findFirst: txMocks.inventoryFindFirst,
      findMany: txMocks.inventoryFindMany,
      update: txMocks.inventoryUpdate,
      updateMany: txMocks.inventoryUpdateMany,
    },
    saleItem: { groupBy: txMocks.saleItemGroupBy, findMany: vi.fn() },
    purchaseOrder: {
      findFirst: txMocks.purchaseOrderFindFirst,
      update: txMocks.purchaseOrderUpdate,
      create: txMocks.purchaseOrderCreate,
      count: txMocks.purchaseOrderCount,
    },
    supplier: { findFirst: txMocks.supplierFindFirst },
    branch: { findFirst: txMocks.branchFindFirst, findMany: txMocks.branchFindMany },
    employee: { findFirst: txMocks.employeeFindFirst },
    cashSession: {
      findFirst: txMocks.cashSessionFindFirst,
      updateMany: txMocks.cashSessionUpdateMany,
    },
    taxRate: { findFirst: txMocks.taxRateFindFirst },
    user: { findFirst: txMocks.userFindFirst },
    person: { findFirst: txMocks.personFindFirst },
    purchaseOrderItem: {
      updateMany: txMocks.purchaseOrderItemUpdateMany,
      findMany: txMocks.purchaseOrderItemFindMany,
    },
    inventoryMovement: { create: txMocks.inventoryMovementCreate },
    saleCounter: { upsert: txMocks.saleCounterUpsert },
    sale: { create: txMocks.saleCreate },
    receivable: { create: txMocks.receivableCreate },
  };
  return {
    prisma: {
      ...tx,
      $transaction: vi.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    },
  };
});

const repo = new PrismaDistributionRepository();
const decimal = (n: number) => new Prisma.Decimal(n);

/** The FROZEN catalog seed on `Item.cost`, written once at Item creation. */
const ITEM = {
  id: 'item_1',
  tenantId: 'tenant-1',
  name: 'Arroz',
  sku: 'ARZ-001',
  cost: decimal(2),
  price: decimal(40),
  saleUnit: null,
};

const BRANCH_A = { id: 'branch-a', tenantId: 'tenant-1', name: 'Sucursal A' };
const BRANCH_B = { id: 'branch-b', tenantId: 'tenant-1', name: 'Sucursal B' };
const USER = {
  id: 'user_1',
  tenantId: 'tenant-1',
  person: { firstName: 'Kevin', lastName: 'Mejía' },
};

function branchCostRow(branchId: string, cost: number) {
  return {
    id: `ibc_${branchId}`,
    tenantId: 'tenant-1',
    itemId: 'item_1',
    branchId,
    cost: decimal(cost),
  };
}

function inventoryRow(branchId: string, stock: number) {
  return {
    id: `inv_${branchId}`,
    tenantId: 'tenant-1',
    itemId: 'item_1',
    branchId,
    stock: decimal(stock),
    minAlert: 5,
  };
}

function poRow(branchId: string, quantity: number, lineCost: number, received = 0) {
  const subtotal = decimal(quantity * lineCost);
  return {
    id: 'po_1',
    tenantId: 'tenant-1',
    supplierId: 'sup_1',
    branchId,
    orderNumber: 'PO-2026-0001',
    status: 'ORDERED',
    subtotal,
    taxAmount: decimal(0),
    total: subtotal,
    notes: null,
    receivedAt: null,
    createdAt: new Date('2026-10-01T09:00:00.000Z'),
    supplier: { name: 'Proveedor 1' },
    branch: { name: 'Sucursal B' },
    items: [
      {
        id: 'poi_1',
        orderId: 'po_1',
        itemId: 'item_1',
        quantity: decimal(quantity),
        receivedQty: decimal(received),
        cost: decimal(lineCost),
        item: { name: 'Arroz' },
      },
    ],
  };
}

function movementRow() {
  return {
    id: 'mov_1',
    tenantId: 'tenant-1',
    branchId: 'branch-b',
    itemId: 'item_1',
    type: 'RECEIVE',
    quantity: decimal(10),
    reason: null,
    costSnapshot: decimal(5),
    notes: null,
    userId: 'user_1',
    refId: 'po_1',
    createdAt: new Date('2026-10-01T10:00:00.000Z'),
  };
}

/** Every `data.cost` any mock ever received, flattened. */
function costWriteTargets(): unknown[] {
  return txMocks.itemUpdate.mock.calls.map(([args]) => args);
}

beforeEach(() => {
  vi.clearAllMocks();

  // Defaults: branch B receives, the catalog seed is 2.00, no branch cost rows
  // exist yet (the pre-M1 / first-arrival case).
  txMocks.itemFindFirst.mockResolvedValue(ITEM);
  txMocks.itemFindMany.mockResolvedValue([ITEM]);
  txMocks.itemBranchCostFindFirst.mockResolvedValue(null);
  txMocks.itemBranchCostFindMany.mockResolvedValue([]);
  txMocks.itemBranchCostFindUnique.mockResolvedValue(null);
  txMocks.inventoryFindFirst.mockResolvedValue(inventoryRow('branch-b', 0));
  txMocks.inventoryFindMany.mockResolvedValue([]);
  txMocks.saleItemGroupBy.mockResolvedValue([]);
  txMocks.purchaseOrderFindFirst.mockResolvedValue(poRow('branch-b', 10, 5));
  txMocks.purchaseOrderItemFindMany.mockResolvedValue([
    { orderId: 'po_1', itemId: 'item_1', quantity: decimal(10), receivedQty: decimal(10) },
  ]);
  txMocks.purchaseOrderUpdate.mockResolvedValue(poRow('branch-b', 10, 5));
  txMocks.purchaseOrderItemUpdateMany.mockResolvedValue({ count: 1 });
  txMocks.inventoryMovementCreate.mockResolvedValue(movementRow());
  txMocks.inventoryUpdate.mockResolvedValue(inventoryRow('branch-b', 10));
  txMocks.inventoryUpdateMany.mockResolvedValue({ count: 1 });
  txMocks.itemUpdate.mockResolvedValue(ITEM);
  txMocks.branchFindFirst.mockResolvedValue(BRANCH_B);
  txMocks.branchFindMany.mockResolvedValue([BRANCH_A, BRANCH_B]);
  txMocks.employeeFindFirst.mockResolvedValue({ branchId: BRANCH_B.id, branch: BRANCH_B });
  txMocks.cashSessionFindFirst.mockResolvedValue({
    id: 'cash_1',
    tenantId: 'tenant-1',
    status: 'OPEN',
    branchId: BRANCH_B.id,
    notes: null,
  });
  txMocks.cashSessionUpdateMany.mockResolvedValue({ count: 1 });
  txMocks.taxRateFindFirst.mockResolvedValue(null);
  txMocks.userFindFirst.mockResolvedValue(USER);
  txMocks.personFindFirst.mockResolvedValue(null);
  txMocks.saleCounterUpsert.mockResolvedValue({ lastNumber: 17 });
  txMocks.purchaseOrderCount.mockResolvedValue(0);
});

// ─── the accessor ────────────────────────────────────────────────────────────

describe('getItemBranchCost — accessor contract', () => {
  it('returns undefined when the pair has no branch-scoped row', async () => {
    txMocks.itemBranchCostFindUnique.mockResolvedValue(null);

    await expect(repo.getItemBranchCost('tenant-1', 'item_1', 'branch-b')).resolves.toBeUndefined();
  });

  it('returns the normalized entity for the requested pair', async () => {
    txMocks.itemBranchCostFindUnique.mockResolvedValue(branchCostRow('branch-b', 5.25));

    await expect(repo.getItemBranchCost('tenant-1', 'item_1', 'branch-b')).resolves.toEqual({
      id: 'ibc_branch-b',
      tenantId: 'tenant-1',
      itemId: 'item_1',
      branchId: 'branch-b',
      cost: 5.25,
    });
  });

  it('looks the pair up by its compound unique, tenant-scoped', async () => {
    txMocks.itemBranchCostFindUnique.mockResolvedValue(branchCostRow('branch-b', 5.25));

    await repo.getItemBranchCost('tenant-1', 'item_1', 'branch-b');

    expect(txMocks.itemBranchCostFindUnique).toHaveBeenCalledWith({
      where: {
        tenantId_itemId_branchId: {
          tenantId: 'tenant-1',
          itemId: 'item_1',
          branchId: 'branch-b',
        },
      },
    });
  });
});

// ─── the acceptance criterion ────────────────────────────────────────────────

describe('receivePurchaseOrder — a branch receive never re-prices another branch', () => {
  it('receives 10 into branch B at 5.00: B becomes 5.00, A stays 2.00, Item.cost is never written', async () => {
    // Branch A: 10 units at 2.00 (never touched by this PO). Branch B: empty.
    txMocks.itemBranchCostFindUnique.mockImplementation(
      async ({ where }: { where: { tenantId_itemId_branchId: { branchId: string } } }) =>
        where.tenantId_itemId_branchId.branchId === 'branch-a'
          ? branchCostRow('branch-a', 2)
          : null
    );
    txMocks.inventoryFindFirst.mockResolvedValue(inventoryRow('branch-b', 0));

    await repo.receivePurchaseOrder('tenant-1', 'po_1', {
      receivedItems: [{ itemId: 'item_1', quantity: 10 }],
      userId: 'user_1',
    });

    // (1) The tenant-wide write is GONE. Not "not called with cost" — never
    // called at all from the receive path.
    expect(txMocks.itemUpdate).not.toHaveBeenCalled();
    expect(costWriteTargets()).toEqual([]);

    // (2) The weighted average landed on branch B, at the PO line cost because
    // B's stock was zero (first arrival adopts the incoming cost).
    expect(txMocks.itemBranchCostUpsert).toHaveBeenCalledTimes(1);
    const upsert = txMocks.itemBranchCostUpsert.mock.calls[0][0] as {
      where: { tenantId_itemId_branchId: { tenantId: string; itemId: string; branchId: string } };
      create: { cost: Prisma.Decimal };
      update: { cost: Prisma.Decimal };
    };
    expect(upsert.where.tenantId_itemId_branchId).toEqual({
      tenantId: 'tenant-1',
      itemId: 'item_1',
      branchId: 'branch-b',
    });
    expect(upsert.update.cost.toNumber()).toBe(5);
    expect(upsert.create.cost.toNumber()).toBe(5);

    // (3) Branch A was never a write target: no upsert names branch-a, so its
    // 2.00 cannot have been touched.
    const writtenBranchIds = txMocks.itemBranchCostUpsert.mock.calls.map(
      ([arg]) => (arg as { where: { tenantId_itemId_branchId: { branchId: string } } }).where.tenantId_itemId_branchId.branchId
    );
    expect(writtenBranchIds).toEqual(['branch-b']);
    expect(writtenBranchIds).not.toContain('branch-a');
  });

  it('re-averages ONLY the receiving branch: 10 at 2.00 + 10 at 5.00 = 3.50, never 5.00', async () => {
    txMocks.inventoryFindFirst.mockResolvedValue(inventoryRow('branch-b', 10));
    txMocks.itemBranchCostFindUnique.mockResolvedValue(branchCostRow('branch-b', 2));

    await repo.receivePurchaseOrder('tenant-1', 'po_1', {
      receivedItems: [{ itemId: 'item_1', quantity: 10 }],
      userId: 'user_1',
    });

    // A weighted average that ignored the pre-receive cost would report 5.00.
    // The proof that :1147 now reads branch B's 2.00, not Item.cost's 2.00 by
    // coincidence: assert on the arithmetic result, which only 3.50 satisfies.
    const upsert = txMocks.itemBranchCostUpsert.mock.calls[0][0] as { update: { cost: Prisma.Decimal } };
    expect(upsert.update.cost.toNumber()).toBe(3.5);
    expect(txMocks.itemUpdate).not.toHaveBeenCalled();
  });

  it('rounds the branch-scoped average to 2 decimal places', async () => {
    // Branch B holds 3 units at 1.11; a 1-unit receive at the PO line cost 2.22
    // averages to (3×1.11 + 1×2.22) / 4 = 1.3875 — a value with FOUR decimals
    // that must be stored as 1.39. The assertion is on the stored value, so an
    // unrounded average fails it.
    txMocks.purchaseOrderFindFirst.mockResolvedValue(poRow('branch-b', 1, 2.22));
    txMocks.purchaseOrderUpdate.mockResolvedValue(poRow('branch-b', 1, 2.22));
    txMocks.purchaseOrderItemFindMany.mockResolvedValue([
      { orderId: 'po_1', itemId: 'item_1', quantity: decimal(1), receivedQty: decimal(1) },
    ]);
    txMocks.inventoryFindFirst.mockResolvedValue(inventoryRow('branch-b', 3));
    txMocks.itemBranchCostFindUnique.mockResolvedValue(branchCostRow('branch-b', 1.11));

    await repo.receivePurchaseOrder('tenant-1', 'po_1', {
      receivedItems: [{ itemId: 'item_1', quantity: 1 }],
      userId: 'user_1',
    });

    const upsert = txMocks.itemBranchCostUpsert.mock.calls[0][0] as {
      update: { cost: Prisma.Decimal };
    };
    expect(upsert.update.cost.toNumber()).toBe(1.39);
    expect(upsert.update.cost.toString()).not.toContain('1.3875');
  });
});

// ─── read sites ──────────────────────────────────────────────────────────────

describe('getInventory — each branch row reports ITS OWN cost', () => {
  it('reports A at 2.00 and B at 5.00 from the same product', async () => {
    txMocks.inventoryFindMany.mockResolvedValue([
      { ...inventoryRow('branch-a', 10), item: ITEM },
      { ...inventoryRow('branch-b', 10), item: ITEM },
    ]);
    // Real Prisma honours `where.branchId`; the mock must too, otherwise branch
    // A's lookup would return branch B's row and the assertion would be fake.
    txMocks.itemBranchCostFindMany.mockImplementation(
      async ({ where }: { where: { branchId: string; itemId: { in: string[] } } }) =>
        [branchCostRow('branch-a', 2), branchCostRow('branch-b', 5)].filter(
          (r) =>
            r.branchId === where.branchId && where.itemId.in.includes(r.itemId)
        )
    );

    const items = await repo.getInventory('tenant-1');

    const costByBranch = Object.fromEntries(items.map((i) => [i.branchId, i.cost]));
    expect(costByBranch).toEqual({ 'branch-a': 2, 'branch-b': 5 });
    // The tenant-wide scalar (2.00) would have reported 2.00 for both rows.
    expect(items.map((i) => i.cost)).not.toEqual([2, 2]);
  });

  it('falls back to the frozen catalog seed for a pair with no branch cost row', async () => {
    txMocks.inventoryFindMany.mockResolvedValue([
      { ...inventoryRow('branch-c', 5), item: ITEM },
    ]);
    txMocks.itemBranchCostFindMany.mockResolvedValue([]);

    const items = await repo.getInventory('tenant-1');

    expect(items[0].cost).toBe(2);
  });
});

describe('updateInventoryItem — a manual cost edit is branch-scoped too', () => {
  it('writes the cost to the NAMED branch and never to Item.cost', async () => {
    txMocks.itemFindFirst.mockResolvedValue({ ...ITEM, inventory: [inventoryRow('branch-b', 10)] });
    txMocks.branchFindFirst.mockResolvedValue(BRANCH_B);
    txMocks.inventoryFindFirst.mockResolvedValue(inventoryRow('branch-b', 10));
    txMocks.inventoryUpdate.mockResolvedValue(inventoryRow('branch-b', 10));

    const updated = await repo.updateInventoryItem('tenant-1', 'item_1', {
      branchId: 'branch-b',
      cost: 6.5,
    });

    expect(txMocks.itemBranchCostUpsert).toHaveBeenCalledWith({
      where: {
        tenantId_itemId_branchId: {
          tenantId: 'tenant-1',
          itemId: 'item_1',
          branchId: 'branch-b',
        },
      },
      create: {
        tenantId: 'tenant-1',
        itemId: 'item_1',
        branchId: 'branch-b',
        cost: decimal(6.5),
      },
      update: { cost: decimal(6.5) },
    });
    // The catalog PATCH still runs for the other fields, but `cost` is not one
    // of them any more.
    expect(txMocks.itemUpdate).toHaveBeenCalledWith({
      where: { id: 'item_1' },
      data: {},
    });
    expect(updated.cost).toBe(6.5);
  });

  it('refuses a cost edit with no branch (400), never guessing one', async () => {
    txMocks.itemFindFirst.mockResolvedValue({ ...ITEM, inventory: [inventoryRow('branch-b', 10)] });

    await expect(
      repo.updateInventoryItem('tenant-1', 'item_1', { cost: 6.5 })
    ).rejects.toMatchObject({
      status: 400,
      message: 'Debe indicar la sucursal para actualizar el costo',
    });
    expect(txMocks.itemBranchCostUpsert).not.toHaveBeenCalled();
  });
});

describe('createPurchaseOrder — the PO is priced from the ORDERING branch cost', () => {
  it('prices the subtotal from branch B, not from Item.cost', async () => {
    txMocks.supplierFindFirst.mockResolvedValue({ id: 'sup_1', isActive: true });
    txMocks.branchFindFirst.mockResolvedValue(BRANCH_B);
    txMocks.itemFindMany.mockResolvedValue([ITEM]);
    // Branch B holds the product at 5.00; Item.cost still carries the 2.00 seed.
    txMocks.itemBranchCostFindMany.mockResolvedValue([branchCostRow('branch-b', 5)]);
    txMocks.purchaseOrderCreate.mockResolvedValue(poRow('branch-b', 10, 5));

    await repo.createPurchaseOrder('tenant-1', {
      supplierId: 'sup_1',
      branchId: 'branch-b',
      items: [{ itemId: 'item_1', quantity: 10 }],
    });

    const create = txMocks.purchaseOrderCreate.mock.calls[0][0] as {
      data: { subtotal: Prisma.Decimal; items: { create: { cost: Prisma.Decimal }[] } };
    };
    // 10 × 5.00 = 50.00. Pricing off Item.cost would have produced 20.00.
    expect(create.data.subtotal.toNumber()).toBe(50);
    expect(create.data.items.create[0].cost.toNumber()).toBe(5);
    expect(txMocks.itemUpdate).not.toHaveBeenCalled();
  });
});

describe('registerSale — the SaleItem snapshot is the SELLING branch cost', () => {
  it('snapshots 5.00 from branch B, not the 2.00 tenant-wide seed', async () => {
    txMocks.itemFindMany.mockResolvedValue([ITEM]);
    txMocks.itemBranchCostFindMany.mockResolvedValue([branchCostRow('branch-b', 5)]);
    txMocks.saleCreate.mockResolvedValue({
      id: 'sale_1',
      tenantId: 'tenant-1',
      cashSessionId: 'cash_1',
      personId: null,
      subtotal: decimal(40),
      taxAmount: decimal(0),
      discount: decimal(0),
      total: decimal(40),
      paymentMethod: 'CASH',
      paidAmount: decimal(40),
      balance: decimal(0),
      invoiceNumber: 'INV-20261001-000001',
      status: 'COMPLETED',
      createdAt: new Date('2026-10-01T11:00:00.000Z'),
      items: [
        {
          id: 'si_1',
          itemId: 'item_1',
          quantity: decimal(1),
          price: decimal(40),
          cost: decimal(5),
          item: { name: 'Arroz', saleUnit: null },
        },
      ],
    });

    await repo.registerSale('tenant-1', {
      lines: [{ itemId: 'item_1', quantity: 1 }],
      discount: 0,
      paymentMethod: 'CASH',
      userId: 'user_1',
    });

    const create = txMocks.saleCreate.mock.calls[0][0] as {
      data: { items: { create: { cost: Prisma.Decimal }[] } };
    };
    expect(create.data.items.create[0].cost.toNumber()).toBe(5);
    expect(txMocks.itemUpdate).not.toHaveBeenCalled();
  });
});

describe('createInventoryAdjustment — the ledger snapshot is the ADJUSTED branch cost', () => {
  it('snapshots branch B 5.00 on the ADJUSTMENT row', async () => {
    txMocks.branchFindFirst.mockResolvedValue(BRANCH_B);
    txMocks.itemFindFirst.mockResolvedValue(ITEM);
    txMocks.inventoryFindFirst.mockResolvedValue(inventoryRow('branch-b', 10));
    txMocks.itemBranchCostFindUnique.mockResolvedValue(branchCostRow('branch-b', 5));
    txMocks.inventoryMovementCreate.mockResolvedValue({
      ...movementRow(),
      type: 'ADJUSTMENT',
      quantity: decimal(-1),
      reason: 'MERMA',
    });

    await repo.createInventoryAdjustment('tenant-1', {
      branchId: 'branch-b',
      itemId: 'item_1',
      quantity: -1,
      reason: 'MERMA',
      userId: 'user_1',
    });

    const create = txMocks.inventoryMovementCreate.mock.calls[0][0] as {
      data: { costSnapshot: Prisma.Decimal };
    };
    expect(create.data.costSnapshot.toNumber()).toBe(5);
    expect(txMocks.itemUpdate).not.toHaveBeenCalled();
  });
});