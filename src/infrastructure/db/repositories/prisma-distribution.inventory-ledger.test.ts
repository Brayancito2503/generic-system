import { describe, expect, it, beforeEach, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { PrismaDistributionRepository } from '@/infrastructure/db/repositories/prisma-distribution.repository';

// Repository-level tests: the Prisma client is mocked at the db layer (same
// technique as login/route.test.ts) and $transaction runs the callback against
// a tx object that shares the same method mocks, so the ledger logic and the
// 400/409 guards are exercised without a database.
const txMocks = vi.hoisted(() => ({
  branchFindFirst: vi.fn(),
  itemFindFirst: vi.fn(),
  inventoryFindFirst: vi.fn(),
  inventoryUpdate: vi.fn(),
  inventoryMovementCreate: vi.fn(),
  // S2b: adjustments and physical counts snapshot the ADJUSTED branch's cost.
  itemBranchCostFindMany: vi.fn(),
  itemBranchCostFindUnique: vi.fn(),
  itemBranchCostUpsert: vi.fn(),
  userFindFirst: vi.fn(),
}));

vi.mock('@/infrastructure/db/prisma', () => {
  const tx = {
    branch: { findFirst: txMocks.branchFindFirst },
    item: { findFirst: txMocks.itemFindFirst },
    inventory: {
      findFirst: txMocks.inventoryFindFirst,
      update: txMocks.inventoryUpdate,
    },
    inventoryMovement: { create: txMocks.inventoryMovementCreate },
    // S2b: adjustments and counts snapshot the ADJUSTED branch's cost.
    itemBranchCost: {
      findMany: txMocks.itemBranchCostFindMany,
      findUnique: txMocks.itemBranchCostFindUnique,
      upsert: txMocks.itemBranchCostUpsert,
    },
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

const BRANCH = { id: 'branch-1' };
const ITEM = {
  id: 'item_1',
  tenantId: 'tenant-1',
  name: 'Arroz',
  sku: 'ARZ-001',
  cost: decimal(30),
  price: decimal(40),
};
const USER = {
  id: 'user_1',
  tenantId: 'tenant-1',
  person: { firstName: 'Kevin', lastName: 'Mejía' },
};

function inventoryRow(stock: number) {
  return {
    id: 'inv_1',
    tenantId: 'tenant-1',
    itemId: 'item_1',
    branchId: 'branch-1',
    stock: decimal(stock),
    minAlert: 5,
  };
}

function movementRow(quantity: number, reason: string) {
  return {
    id: 'mov_1',
    tenantId: 'tenant-1',
    branchId: 'branch-1',
    itemId: 'item_1',
    type: 'ADJUSTMENT',
    quantity: decimal(quantity),
    reason,
    costSnapshot: decimal(30),
    notes: 'Diferencia por conteo físico',
    userId: 'user_1',
    refId: null,
    createdAt: new Date('2026-09-22T12:00:00.000Z'),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  txMocks.branchFindFirst.mockResolvedValue(BRANCH);
  txMocks.itemFindFirst.mockResolvedValue(ITEM);
  txMocks.inventoryFindFirst.mockResolvedValue(inventoryRow(10));
  txMocks.inventoryUpdate.mockResolvedValue(inventoryRow(8));
  txMocks.inventoryMovementCreate.mockResolvedValue(movementRow(-2, 'MERMA'));
  // S2b: branch-1 holds the product at 30.00, so every snapshot below keeps
  // reporting the same numbers it did when it read `Item.cost` directly.
  txMocks.itemBranchCostFindMany.mockResolvedValue([]);
  txMocks.itemBranchCostFindUnique.mockResolvedValue(null);
  txMocks.userFindFirst.mockResolvedValue(USER);
});

describe('createInventoryAdjustment — sign convention + stock guards', () => {
  it('rejects a positive quantity with a loss reason (400) before any write', async () => {
    await expect(
      repo.createInventoryAdjustment('tenant-1', {
        branchId: 'branch-1',
        itemId: 'item_1',
        quantity: 2,
        reason: 'MERMA',
        userId: 'user_1',
      })
    ).rejects.toMatchObject({ status: 400 });

    expect(txMocks.inventoryUpdate).not.toHaveBeenCalled();
    expect(txMocks.inventoryMovementCreate).not.toHaveBeenCalled();
  });

  it('rejects a negative SOBRANTE (400) — corrections are always positive', async () => {
    await expect(
      repo.createInventoryAdjustment('tenant-1', {
        branchId: 'branch-1',
        itemId: 'item_1',
        quantity: -3,
        reason: 'SOBRANTE',
        userId: 'user_1',
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects a loss bigger than the current stock with 409', async () => {
    txMocks.inventoryFindFirst.mockResolvedValue(inventoryRow(2));

    await expect(
      repo.createInventoryAdjustment('tenant-1', {
        branchId: 'branch-1',
        itemId: 'item_1',
        quantity: -3,
        reason: 'VENCIMIENTO',
        userId: 'user_1',
      })
    ).rejects.toMatchObject({
      status: 409,
      message: 'No hay stock suficiente para el ajuste',
    });

    expect(txMocks.inventoryUpdate).not.toHaveBeenCalled();
    expect(txMocks.inventoryMovementCreate).not.toHaveBeenCalled();
  });

  it('applies the stock delta and writes the ADJUSTMENT row in one tx', async () => {
    const result = await repo.createInventoryAdjustment('tenant-1', {
      branchId: 'branch-1',
      itemId: 'item_1',
      quantity: -2,
      reason: 'MERMA',
      notes: 'Caja dañada en recepción',
      userId: 'user_1',
    });

    expect(txMocks.inventoryUpdate).toHaveBeenCalledWith({
      where: { id: 'inv_1' },
      data: { stock: { increment: -2 } },
    });
    expect(txMocks.inventoryMovementCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          type: 'ADJUSTMENT',
          quantity: -2,
          reason: 'MERMA',
          costSnapshot: decimal(30),
          notes: 'Caja dañada en recepción',
          userId: 'user_1',
        }),
      })
    );

    expect(result).toMatchObject({
      itemId: 'item_1',
      itemName: 'Arroz',
      type: 'ADJUSTMENT',
      quantity: -2,
      reason: 'MERMA',
      cost: 30,
      userId: 'user_1',
      userName: 'Kevin Mejía',
    });
  });
});

describe('createInventoryCountBatch — diff = counted − book', () => {
  it('posts SOBRANTE (positive diff) with the physical-count note', async () => {
    txMocks.inventoryMovementCreate.mockResolvedValue(movementRow(3, 'SOBRANTE'));

    const created = await repo.createInventoryCountBatch('tenant-1', {
      branchId: 'branch-1',
      items: [{ itemId: 'item_1', countedQuantity: 13 }],
      userId: 'user_1',
    });

    expect(txMocks.inventoryUpdate).toHaveBeenCalledWith({
      where: { id: 'inv_1' },
      data: { stock: { increment: 3 } },
    });
    expect(txMocks.inventoryMovementCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'ADJUSTMENT',
          quantity: 3,
          reason: 'SOBRANTE',
          notes: 'Diferencia por conteo físico',
        }),
      })
    );
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ quantity: 3, reason: 'SOBRANTE' });
  });

  it('posts MERMA (negative diff) when counted below book', async () => {
    txMocks.inventoryMovementCreate.mockResolvedValue(movementRow(-2, 'MERMA'));

    const created = await repo.createInventoryCountBatch('tenant-1', {
      branchId: 'branch-1',
      items: [{ itemId: 'item_1', countedQuantity: 8 }],
      userId: 'user_1',
    });

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ quantity: -2, reason: 'MERMA' });
  });

  it('skips zero diffs — nothing is written and the result is empty', async () => {
    const created = await repo.createInventoryCountBatch('tenant-1', {
      branchId: 'branch-1',
      items: [{ itemId: 'item_1', countedQuantity: 10 }],
      userId: 'user_1',
    });

    expect(created).toEqual([]);
    expect(txMocks.inventoryUpdate).not.toHaveBeenCalled();
    expect(txMocks.inventoryMovementCreate).not.toHaveBeenCalled();
  });

  it('skips sub-cent diffs (float tolerance) instead of polluting the ledger', async () => {
    const created = await repo.createInventoryCountBatch('tenant-1', {
      branchId: 'branch-1',
      items: [{ itemId: 'item_1', countedQuantity: 10.004 }],
      userId: 'user_1',
    });

    expect(created).toEqual([]);
    expect(txMocks.inventoryMovementCreate).not.toHaveBeenCalled();
  });
});