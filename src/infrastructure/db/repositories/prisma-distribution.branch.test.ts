import { describe, expect, it, beforeEach, vi } from 'vitest';
import { PrismaDistributionRepository } from '@/infrastructure/db/repositories/prisma-distribution.repository';

// Branch persistence (distribution-branches R1/R3) — repository-level proof
// that the tenant scope is a database fact and not a route convention:
//   (a) listBranches reads ONLY the session tenant, in creation order,
//   (b) createBranch writes the tenant from its argument, never from input,
//   (c) createBranch starts the new branch with ZERO stock for every product,
//   (d) updateBranch is tenant-scoped and resolves a foreign branch as 404,
//   (e) a null address clears the column while omitted fields stay untouched.
// The Prisma client is mocked at the db layer (same technique as
// prisma-distribution.velocity-sort.test.ts).
const dbMocks = vi.hoisted(() => ({
  branchFindMany: vi.fn(),
  branchFindFirst: vi.fn(),
  branchCreate: vi.fn(),
  branchUpdate: vi.fn(),
  itemFindMany: vi.fn(),
  inventoryCreateMany: vi.fn(),
}));

vi.mock('@/infrastructure/db/prisma', () => ({
  prisma: {
    branch: {
      findMany: dbMocks.branchFindMany,
      findFirst: dbMocks.branchFindFirst,
      create: dbMocks.branchCreate,
      update: dbMocks.branchUpdate,
    },
    item: { findMany: dbMocks.itemFindMany },
    inventory: { createMany: dbMocks.inventoryCreateMany },
  },
}));

const repo = new PrismaDistributionRepository();

const CENTRAL = {
  id: 'branch-1',
  tenantId: 'tenant-1',
  name: 'Sucursal Central',
  address: 'Managua',
  createdAt: new Date('2026-01-05T00:00:00.000Z'),
};
const NORTH = {
  id: 'branch-2',
  tenantId: 'tenant-1',
  name: 'Sucursal Norte',
  address: null,
  createdAt: new Date('2026-02-01T00:00:00.000Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
  dbMocks.branchFindMany.mockResolvedValue([CENTRAL, NORTH]);
  dbMocks.branchFindFirst.mockResolvedValue(CENTRAL);
  dbMocks.branchCreate.mockResolvedValue(NORTH);
  dbMocks.branchUpdate.mockResolvedValue({ ...CENTRAL, name: 'Sucursal Renombrada' });
  // A tenant with two existing products when the new branch is created.
  dbMocks.itemFindMany.mockResolvedValue([{ id: 'item-1' }, { id: 'item-2' }]);
  dbMocks.inventoryCreateMany.mockResolvedValue({ count: 2 });
});

describe('listBranches', () => {
  it('reads only the session tenant, oldest branch first', async () => {
    const branches = await repo.listBranches('tenant-1');

    expect(dbMocks.branchFindMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      orderBy: { createdAt: 'asc' },
    });
    expect(branches.map((b) => b.id)).toEqual(['branch-1', 'branch-2']);
    expect(branches[0].address).toBe('Managua');
    expect(branches[1].address).toBeNull();
  });
});

describe('createBranch', () => {
  it('persists the tenant from the argument and a null address when omitted', async () => {
    const created = await repo.createBranch('tenant-1', { name: 'Sucursal Norte' });

    expect(dbMocks.branchCreate).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1',
        name: 'Sucursal Norte',
        address: null,
      },
    });
    expect(created).toEqual({
      id: 'branch-2',
      tenantId: 'tenant-1',
      name: 'Sucursal Norte',
      address: null,
      createdAt: NORTH.createdAt,
    });
  });

  it('keeps a submitted address verbatim', async () => {
    dbMocks.branchCreate.mockResolvedValue({ ...NORTH, address: 'Chinandega' });

    const created = await repo.createBranch('tenant-1', {
      name: 'Sucursal Norte',
      address: 'Chinandega',
    });

    expect(dbMocks.branchCreate).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1',
        name: 'Sucursal Norte',
        address: 'Chinandega',
      },
    });
    expect(created.address).toBe('Chinandega');
  });
});

describe('createBranch — a new branch inherits no stock (R3)', () => {
  it('provisions a zero-quantity stock row for every existing product', async () => {
    await repo.createBranch('tenant-1', { name: 'Sucursal Norte' });

    // A branch-scoped read must report 0 at the new branch, never "unknown" and
    // never another branch's quantity.
    expect(dbMocks.inventoryCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          tenantId: 'tenant-1',
          itemId: 'item-1',
          branchId: 'branch-2',
          stock: expect.anything(),
        }),
        expect.objectContaining({
          tenantId: 'tenant-1',
          itemId: 'item-2',
          branchId: 'branch-2',
          stock: expect.anything(),
        }),
      ],
    });
    const rows = dbMocks.inventoryCreateMany.mock.calls[0][0].data;
    // Decimal(10,2) exact zero, and `minAlert: 0` so a brand-new empty branch
    // does not report every product as low stock on the dashboard.
    expect(rows[0].stock.toNumber()).toBe(0);
    expect(rows[0].minAlert).toBe(0);
  });

  it('writes no stock row when the tenant has no products yet', async () => {
    dbMocks.itemFindMany.mockResolvedValue([]);

    await repo.createBranch('tenant-1', { name: 'Sucursal Norte' });

    expect(dbMocks.inventoryCreateMany).not.toHaveBeenCalled();
  });

  it('reads the products under the session tenant only', async () => {
    await repo.createBranch('tenant-1', { name: 'Sucursal Norte' });

    expect(dbMocks.itemFindMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      select: { id: true },
    });
  });
});

describe('updateBranch', () => {
  it('writes only the fields the caller defined', async () => {
    const updated = await repo.updateBranch('tenant-1', 'branch-1', {
      name: 'Sucursal Renombrada',
    });

    // An omitted `address` must not appear in `data` at all: sending
    // `address: null` here would silently clear a field nobody edited.
    expect(dbMocks.branchUpdate).toHaveBeenCalledWith({
      where: { id: 'branch-1' },
      data: { name: 'Sucursal Renombrada' },
    });
    expect(updated.name).toBe('Sucursal Renombrada');
    expect(updated.tenantId).toBe('tenant-1');
  });

  it('clears the address on an explicit null and keeps the name untouched', async () => {
    dbMocks.branchUpdate.mockResolvedValue({ ...CENTRAL, address: null });

    const updated = await repo.updateBranch('tenant-1', 'branch-1', { address: null });

    expect(dbMocks.branchUpdate).toHaveBeenCalledWith({
      where: { id: 'branch-1' },
      data: { address: null },
    });
    expect(updated.address).toBeNull();
    // The name survives because it was never part of `data`.
    expect(updated.name).toBe('Sucursal Central');
  });

  it('resolves the branch under the session tenant, so a foreign id is 404', async () => {
    dbMocks.branchFindFirst.mockResolvedValue(null);

    await expect(
      repo.updateBranch('tenant-1', 'branch-of-tenant-2', { name: 'Secuestro' })
    ).rejects.toMatchObject({ status: 404, message: 'Sucursal no encontrada' });

    // The tenant filter is what makes the id unresolvable — assert the WHERE,
    // not just the throw.
    expect(dbMocks.branchFindFirst).toHaveBeenCalledWith({
      where: { id: 'branch-of-tenant-2', tenantId: 'tenant-1' },
    });
    expect(dbMocks.branchUpdate).not.toHaveBeenCalled();
  });
});
