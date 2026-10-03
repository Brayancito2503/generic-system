import { describe, expect, it, beforeEach, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { PrismaDistributionRepository } from '@/infrastructure/db/repositories/prisma-distribution.repository';

// Fase 2 Slice B (per-sale unit / weight sales) — repository-level proof that
// weight items are stocked, priced AND ledgered in their sale unit with
// Decimal-exact math (Option (i): no conversion factor):
//   (a) alta with saleUnit LIBRA + stock 100 → INITIAL ledger +100 lb,
//   (b) legacy items (null/UNIDAD) keep piece-based behavior unchanged,
//   (c) 9.6 lb × C$45 = C$432.00 exactly (Decimal, not 431.999…),
//   (d) the SALE ledger row is -9.6 and the stock decrement is decimal(9.6),
//   (e) one INITIAL row book-ends the creation, then SALE rows move it.
// The Prisma client is mocked at the db layer; $transaction runs the callback
// against a tx object sharing the same method mocks (same technique as
// prisma-distribution.fractional.test.ts / inventory-ledger.test.ts).
const txMocks = vi.hoisted(() => ({
  branchFindFirst: vi.fn(),
  // D11: registerSale derives the sale's branch from the session user's
  // Employee record, so both sale suites carry this mock surface (R8).
  branchFindMany: vi.fn(),
  employeeFindFirst: vi.fn(),
  itemFindMany: vi.fn(),
  itemFindFirst: vi.fn(),
  itemCreate: vi.fn(),
  itemUpdate: vi.fn(),
  inventoryCreate: vi.fn(),
  inventoryFindFirst: vi.fn(),
  inventoryUpdateMany: vi.fn(),
  inventoryMovementCreate: vi.fn(),
  cashSessionFindFirst: vi.fn(),
  cashSessionUpdateMany: vi.fn(),
  personFindFirst: vi.fn(),
  taxRateFindFirst: vi.fn(),
  saleCounterUpsert: vi.fn(),
  saleCreate: vi.fn(),
  userFindFirst: vi.fn(),
}));

vi.mock('@/infrastructure/db/prisma', () => {
  const tx = {
    branch: { findFirst: txMocks.branchFindFirst, findMany: txMocks.branchFindMany },
    employee: { findFirst: txMocks.employeeFindFirst },
    item: {
      findMany: txMocks.itemFindMany,
      findFirst: txMocks.itemFindFirst,
      create: txMocks.itemCreate,
      update: txMocks.itemUpdate,
    },
    inventory: {
      create: txMocks.inventoryCreate,
      findFirst: txMocks.inventoryFindFirst,
      updateMany: txMocks.inventoryUpdateMany,
    },
    inventoryMovement: { create: txMocks.inventoryMovementCreate },
    cashSession: {
      findFirst: txMocks.cashSessionFindFirst,
      updateMany: txMocks.cashSessionUpdateMany,
    },
    person: { findFirst: txMocks.personFindFirst },
    taxRate: { findFirst: txMocks.taxRateFindFirst },
    saleCounter: { upsert: txMocks.saleCounterUpsert },
    sale: { create: txMocks.saleCreate },
    user: { findFirst: txMocks.userFindFirst },
  };
  return {
    prisma: {
      ...tx,
      $transaction: vi.fn(
        (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)
      ),
    },
  };
});

const repo = new PrismaDistributionRepository();
const decimal = (n: number) => new Prisma.Decimal(n);

const BRANCH = { id: 'branch-1', tenantId: 'tenant-1', name: 'Sucursal Central' };
const USER = {
  id: 'user_1',
  tenantId: 'tenant-1',
  person: { firstName: 'Kevin', lastName: 'Mejía' },
};
const OPEN_SESSION = {
  id: 'cash_1',
  tenantId: 'tenant-1',
  status: 'OPEN',
  branchId: 'branch-1',
};

/** Weight item: stocked/priced/ledgered in POUNDS (Option (i), no conversion). */
function weightItem() {
  return {
    id: 'item_1',
    tenantId: 'tenant-1',
    name: 'Arroz Oro',
    sku: 'ARZ-001',
    cost: decimal(30),
    price: decimal(45),
    saleUnit: 'LIBRA' as const,
  };
}

/** Legacy piece-based item: no saleUnit (null → UNIDAD behavior). */
function legacyItem() {
  return {
    id: 'item_2',
    tenantId: 'tenant-1',
    name: 'Aceite Vegetal 1L',
    sku: 'ACE-001',
    cost: decimal(120),
    price: decimal(150),
    saleUnit: null,
  };
}

function createdItemRow(saleUnit: 'LIBRA' | 'KILOGRAMO' | null, sku = 'ARZ-001') {
  return {
    id: 'item_1',
    tenantId: 'tenant-1',
    sku,
    name: 'Arroz Oro',
    description: null,
    cost: decimal(30),
    price: decimal(45),
    saleUnit,
  };
}

function createdInventoryRow(stock: number) {
  return {
    id: 'inv_1',
    tenantId: 'tenant-1',
    itemId: 'item_1',
    branchId: 'branch-1',
    stock: decimal(stock),
    minAlert: 5,
  };
}

function movementRow(quantity: number, type: string, refId: string | null) {
  return {
    id: `mov_${type}`,
    tenantId: 'tenant-1',
    branchId: 'branch-1',
    itemId: 'item_1',
    type,
    quantity: decimal(quantity),
    reason: null,
    costSnapshot: decimal(30),
    notes: null,
    userId: 'user_1',
    refId,
    createdAt: new Date('2026-09-22T13:00:00.000Z'),
  };
}

function saleRow(item: ReturnType<typeof weightItem> | ReturnType<typeof legacyItem>, quantity: number, subtotal: number) {
  return {
    id: 'sale_1',
    tenantId: 'tenant-1',
    cashSessionId: 'cash_1',
    personId: null,
    subtotal: decimal(subtotal),
    taxAmount: decimal(0),
    discount: decimal(0),
    total: decimal(subtotal),
    paymentMethod: 'CASH',
    paidAmount: decimal(subtotal),
    balance: decimal(0),
    invoiceNumber: 'INV-20260922-000017',
    status: 'COMPLETED',
    createdAt: new Date('2026-09-22T13:00:00.000Z'),
    items: [
      {
        id: 'si_1',
        itemId: item.id,
        quantity: decimal(quantity),
        price: item.price,
        cost: item.cost,
        item: { name: item.name, saleUnit: item.saleUnit },
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  // createInventoryItem defaults
  txMocks.branchFindFirst.mockResolvedValue(BRANCH);
  txMocks.itemFindFirst.mockResolvedValue(null); // SKU is free
  txMocks.itemCreate.mockResolvedValue(createdItemRow('LIBRA'));
  txMocks.inventoryCreate.mockResolvedValue(createdInventoryRow(100));
  txMocks.inventoryMovementCreate.mockResolvedValue(movementRow(100, 'INITIAL', null));

  // registerSale defaults
  txMocks.cashSessionFindFirst.mockResolvedValue(OPEN_SESSION);
  txMocks.cashSessionUpdateMany.mockResolvedValue({ count: 1 });
  // D11: the session user's Employee is assigned to the same branch as the open
  // session, so the derived branch matches OPEN_SESSION.branchId.
  txMocks.employeeFindFirst.mockResolvedValue({
    branchId: BRANCH.id,
    branch: BRANCH,
  });
  txMocks.itemFindMany.mockResolvedValue([weightItem()]);
  txMocks.personFindFirst.mockResolvedValue(null);
  txMocks.taxRateFindFirst.mockResolvedValue(null);
  txMocks.saleCounterUpsert.mockResolvedValue({ lastNumber: 17 });
  txMocks.inventoryUpdateMany.mockResolvedValue({ count: 1 });
  txMocks.saleCreate.mockResolvedValue(saleRow(weightItem(), 9.6, 432));
  txMocks.userFindFirst.mockResolvedValue(USER);
});

describe('createInventoryItem — sale units (Fase 2 Slice B)', () => {
  it('(a) alza a LIBRA item with 100 lb: saleUnit persisted, inventory Decimal, INITIAL ledger +100', async () => {
    const item = await repo.createInventoryItem('tenant-1', {
      sku: 'ARZ-001',
      name: 'Arroz Oro',
      cost: 30,
      price: 45,
      stock: 100,
      minAlert: 5,
      saleUnit: 'LIBRA',
      userId: 'user_1',
    });

    expect(txMocks.itemCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Arroz Oro',
        price: 45,
        saleUnit: 'LIBRA',
      }),
    });
    expect(txMocks.inventoryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        itemId: 'item_1',
        stock: 100,
      }),
    });
    // Ledger origin: INITIAL row with the opening stock (in the SALE unit).
    expect(txMocks.inventoryMovementCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'INITIAL',
          quantity: 100,
          refId: null,
        }),
      })
    );
    expect(item).toMatchObject({ stock: 100, saleUnit: 'LIBRA', price: 45 });
  });

  it('(b) legacy alza without saleUnit keeps null (piece-based behavior unchanged)', async () => {
    txMocks.itemCreate.mockResolvedValue(createdItemRow(null, 'ACE-001'));

    const item = await repo.createInventoryItem('tenant-1', {
      sku: 'ACE-001',
      name: 'Aceite Vegetal 1L',
      cost: 120,
      price: 150,
      stock: 24,
      minAlert: 6,
      userId: 'user_1',
    });

    expect(txMocks.itemCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ saleUnit: null }),
    });
    expect(item.saleUnit).toBeNull();
  });
});

describe('registerSale — weight items price per lb, Decimal-exact', () => {
  it('(c) 9.6 lb × C$45 = C$432.00 exact; stock decrements by decimal(9.6); SALE ledger row −9.6', async () => {
    const sale = await repo.registerSale('tenant-1', {
      lines: [{ itemId: 'item_1', quantity: 9.6 }],
      discount: 0,
      paymentMethod: 'CASH',
      userId: 'user_1',
    });

    expect(txMocks.inventoryUpdateMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        branchId: 'branch-1',
        itemId: 'item_1',
        stock: { gte: decimal(9.6) },
      },
      data: { stock: { decrement: decimal(9.6) } },
    });
    expect(txMocks.saleCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subtotal: decimal(432),
          total: decimal(432),
          items: {
            create: [{ itemId: 'item_1', quantity: 9.6, price: decimal(45), cost: decimal(30) }],
          },
        }),
      })
    );
    expect(txMocks.inventoryMovementCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'SALE', quantity: -9.6, refId: 'sale_1' }),
      })
    );
    expect(sale).toMatchObject({ subtotal: 432, total: 432, items: [{ quantity: 9.6 }] });
  });

  it('(b) legacy item: integer piece sale still decrements and charges in UNIDAD semantics', async () => {
    txMocks.itemFindMany.mockResolvedValue([legacyItem()]);
    txMocks.saleCreate.mockResolvedValue(saleRow(legacyItem(), 2, 300));

    const sale = await repo.registerSale('tenant-1', {
      lines: [{ itemId: 'item_2', quantity: 2 }],
      discount: 0,
      paymentMethod: 'CASH',
      userId: 'user_1',
    });

    expect(txMocks.inventoryUpdateMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        branchId: 'branch-1',
        itemId: 'item_2',
        stock: { gte: decimal(2) },
      },
      data: { stock: { decrement: decimal(2) } },
    });
    expect(sale.total).toBe(300);
  });
});

describe('updateInventoryItem — PATCH saleUnit propagation', () => {
  it('sets KILOGRAMO on a legacy item and reads it back', async () => {
    txMocks.itemFindFirst.mockResolvedValue({
      ...createdItemRow(null),
      inventory: [],
    });
    txMocks.itemUpdate.mockResolvedValue(createdItemRow('KILOGRAMO'));

    const item = await repo.updateInventoryItem('tenant-1', 'item_1', {
      saleUnit: 'KILOGRAMO',
    });

    expect(txMocks.itemUpdate).toHaveBeenCalledWith({
      where: { id: 'item_1' },
      data: { saleUnit: 'KILOGRAMO' },
    });
    expect(item.saleUnit).toBe('KILOGRAMO');
  });

  it('null resets a weight item back to legacy piece-based units', async () => {
    txMocks.itemFindFirst.mockResolvedValue({
      ...createdItemRow('LIBRA'),
      inventory: [],
    });
    txMocks.itemUpdate.mockResolvedValue(createdItemRow(null));

    const item = await repo.updateInventoryItem('tenant-1', 'item_1', {
      saleUnit: null,
    });

    expect(txMocks.itemUpdate).toHaveBeenCalledWith({
      where: { id: 'item_1' },
      data: { saleUnit: null },
    });
    expect(item.saleUnit).toBeNull();
  });
});

describe('(e) INITIAL + SALE ledger consistency for a weight item', () => {
  it('one INITIAL row book-ends the 100 lb alza, then the 9.6 lb sale writes exactly one SALE row', async () => {
    // Lifecycle: create (INITIAL +100 lb) → sell (SALE −9.6 lb).
    await repo.createInventoryItem('tenant-1', {
      sku: 'ARZ-001',
      name: 'Arroz Oro',
      cost: 30,
      price: 45,
      stock: 100,
      minAlert: 5,
      saleUnit: 'LIBRA',
      userId: 'user_1',
    });
    await repo.registerSale('tenant-1', {
      lines: [{ itemId: 'item_1', quantity: 9.6 }],
      discount: 0,
      paymentMethod: 'CASH',
      userId: 'user_1',
    });

    const movements = txMocks.inventoryMovementCreate.mock.calls.map(
      (call) => call[0].data
    );
    expect(movements).toHaveLength(2);
    // INITIAL first (positive, opening stock in the sale unit)…
    expect(movements[0]).toMatchObject({ type: 'INITIAL', quantity: 100 });
    // …then the SALE decrements in the SAME unit (no conversion row between).
    expect(movements[1]).toMatchObject({ type: 'SALE', quantity: -9.6, refId: 'sale_1' });
  });
});