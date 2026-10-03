import { describe, expect, it, beforeEach, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { PrismaDistributionRepository } from '@/infrastructure/db/repositories/prisma-distribution.repository';

// Fase 2 Slice C (sales-velocity reorder) — repository-level proof that the
// inventory list can be ranked by what actually sells:
//   (a) the default ordering is untouched (Item.name asc, one aggregate call),
//   (b) `velocity` ranks by 30-day units sold descending,
//   (c) ties fall back to Item.name asc and never-sold products (0) go last,
//   (d) the aggregate is tenant-scoped THROUGH the `sale` relation (SaleItem
//       has no tenantId column) and bounded to the last 30 days,
//   (e) Decimal sums compare exactly, so equal products never swap places.
// The Prisma client is mocked at the db layer (same technique as
// prisma-distribution.sale-unit.test.ts / fractional.test.ts).
const dbMocks = vi.hoisted(() => ({
  inventoryFindMany: vi.fn(),
  saleItemGroupBy: vi.fn(),
}));

vi.mock('@/infrastructure/db/prisma', () => ({
  prisma: {
    inventory: { findMany: dbMocks.inventoryFindMany },
    saleItem: { groupBy: dbMocks.saleItemGroupBy },
  },
}));

const repo = new PrismaDistributionRepository();
const decimal = (n: number) => new Prisma.Decimal(n);

/** Inventory row with its Item + Branch graph, as `getInventory` reads it. */
function inventoryRow(id: string, name: string, stock = 10, branchId = 'branch-1') {
  return {
    id: `inv_${id}_${branchId}`,
    tenantId: 'tenant-1',
    itemId: id,
    branchId,
    stock: decimal(stock),
    minAlert: 5,
    item: {
      id,
      tenantId: 'tenant-1',
      sku: `SKU-${id}`,
      name,
      description: null,
      cost: decimal(30),
      price: decimal(45),
      saleUnit: null,
      isService: false,
      attributes: {},
    },
    branch: {
      id: branchId,
      tenantId: 'tenant-1',
      name: branchId === 'branch-2' ? 'Sucursal Norte' : 'Sucursal Central',
    },
  };
}

/** Rows arrive from the DB already ordered by `item.name` asc. */
const ROWS = [
  inventoryRow('item_1', 'Aceite Vegetal 1L'),
  inventoryRow('item_2', 'Arroz Oro'),
  inventoryRow('item_3', 'Azúcar 5lb'),
  inventoryRow('item_4', 'Detergente 5L'),
];

const namesOf = (items: Awaited<ReturnType<typeof repo.getInventory>>) =>
  items.map((i) => i.name);

beforeEach(() => {
  vi.clearAllMocks();
  dbMocks.inventoryFindMany.mockResolvedValue(ROWS);
  // Default: only Arroz Oro sold anything in the window.
  dbMocks.saleItemGroupBy.mockResolvedValue([
    { itemId: 'item_2', _sum: { quantity: decimal(30) } },
  ]);
});

describe('getInventory — default name ordering (Fase 2 Slice C)', () => {
  it('(a) keeps Item.name asc and never reorders the list', async () => {
    const items = await repo.getInventory('tenant-1');

    expect(namesOf(items)).toEqual([
      'Aceite Vegetal 1L',
      'Arroz Oro',
      'Azúcar 5lb',
      'Detergente 5L',
    ]);
    // The ordering itself is still delegated to the DB, not to a client sort.
    expect(dbMocks.inventoryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { item: { name: 'asc' } } })
    );
  });

  it('(a) an explicit sort=name is byte-for-byte the default behavior', async () => {
    const implicit = await repo.getInventory('tenant-1');
    const explicit = await repo.getInventory('tenant-1', 'name');

    expect(namesOf(explicit)).toEqual(namesOf(implicit));
  });

  it('(d) every read stays tenant-scoped and the aggregate is 30-day bounded', async () => {
    await repo.getInventory('tenant-1');

    expect(dbMocks.inventoryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-1' } })
    );
    const call = dbMocks.saleItemGroupBy.mock.calls[0][0] as unknown as {
      by: string[];
      where: { sale: { tenantId: string; createdAt: { gte: Date } } };
      _sum: { quantity: boolean };
    };
    // SaleItem has no tenantId: the window MUST travel through the sale relation.
    expect(call.where.sale.tenantId).toBe('tenant-1');
    expect(call.where.sale.createdAt.gte).toBeInstanceOf(Date);
    expect(call.by).toEqual(['itemId']);
    expect(call._sum).toEqual({ quantity: true });
  });

  it('(a) exposes unitsSold30d on every row, scoring never-sold products 0', async () => {
    const items = await repo.getInventory('tenant-1');

    expect(items.map((i) => i.unitsSold30d)).toEqual([0, 30, 0, 0]);
  });
});

describe('getInventory — sort=velocity', () => {
  it('(b) ranks by 30-day units sold descending', async () => {
    dbMocks.saleItemGroupBy.mockResolvedValue([
      { itemId: 'item_3', _sum: { quantity: decimal(52.5) } },
      { itemId: 'item_1', _sum: { quantity: decimal(7) } },
      { itemId: 'item_4', _sum: { quantity: decimal(120) } },
    ]);

    const items = await repo.getInventory('tenant-1', 'velocity');

    expect(namesOf(items)).toEqual([
      'Detergente 5L', // 120
      'Azúcar 5lb', // 52.5
      'Aceite Vegetal 1L', // 7
      'Arroz Oro', // never sold → 0
    ]);
  });

  it('(c) never-sold products sort last, keeping name asc among them', async () => {
    const items = await repo.getInventory('tenant-1', 'velocity');

    // Arroz Oro is the ONLY sold product, so it jumps to the top and the three
    // never-sold ones trail behind in their original alphabetical order.
    expect(namesOf(items)).toEqual([
      'Arroz Oro',
      'Aceite Vegetal 1L',
      'Azúcar 5lb',
      'Detergente 5L',
    ]);
    expect(items.filter((i) => i.unitsSold30d === 0)).toHaveLength(3);
  });

  it('(c) equal velocity falls back to Item.name asc', async () => {
    // Detergente outranks the tie on its own merit, so the whole list must move
    // while the three tied products KEEP their alphabetical relative order.
    dbMocks.saleItemGroupBy.mockResolvedValue([
      { itemId: 'item_1', _sum: { quantity: decimal(10) } },
      { itemId: 'item_2', _sum: { quantity: decimal(10) } },
      { itemId: 'item_3', _sum: { quantity: decimal(10) } },
      { itemId: 'item_4', _sum: { quantity: decimal(99) } },
    ]);

    const items = await repo.getInventory('tenant-1', 'velocity');

    expect(namesOf(items)).toEqual([
      'Detergente 5L', // 99
      'Aceite Vegetal 1L', // 10 (tie → name asc)
      'Arroz Oro', // 10
      'Azúcar 5lb', // 10
    ]);
  });

  it('(e) fractional sums compare exactly and never swap equal products', async () => {
    // 0.1 + 0.2 = 0.30000000000000004 in float math; Decimal keeps the tie exact
    // so the name tie-break decides, as the operator expects. Detergente
    // outranks them, so a float tie would visibly break the expected order.
    dbMocks.saleItemGroupBy.mockResolvedValue([
      { itemId: 'item_1', _sum: { quantity: decimal(0.1).plus(decimal(0.2)) } },
      { itemId: 'item_2', _sum: { quantity: decimal(0.3) } },
      { itemId: 'item_4', _sum: { quantity: decimal(9) } },
    ]);

    const items = await repo.getInventory('tenant-1', 'velocity');

    expect(namesOf(items)).toEqual([
      'Detergente 5L', // 9
      'Aceite Vegetal 1L', // 0.3 (exact tie → name asc)
      'Arroz Oro', // 0.3
      'Azúcar 5lb', // never sold → 0
    ]);
    expect(items.map((i) => i.unitsSold30d)).toEqual([9, 0.3, 0.3, 0]);
  });

  it('(b) an empty sales window leaves the alphabetical order intact', async () => {
    dbMocks.saleItemGroupBy.mockResolvedValue([]);

    const items = await repo.getInventory('tenant-1', 'velocity');

    // Every score is 0 → the stable sort is a no-op and the DB order survives.
    expect(dbMocks.saleItemGroupBy).toHaveBeenCalled();
    expect(namesOf(items)).toEqual([
      'Aceite Vegetal 1L',
      'Arroz Oro',
      'Azúcar 5lb',
      'Detergente 5L',
    ]);
    expect(items.every((i) => i.unitsSold30d === 0)).toBe(true);
  });
});

// S1a (multi-branch read correctness). `Inventory` is uniquely keyed by
// (tenantId, itemId, branchId), so the SAME product stocked at two branches is
// two legitimate rows — but today both carry `id: row.item.id`, so the list
// cannot tell them apart and the ranking treats the duplicate as extra weight.
describe('getInventory — branch-explicit rows (S1a)', () => {
  /** Aceite at both branches + Arroz at the first one, name-asc as the DB returns. */
  const MULTI_BRANCH_ROWS = [
    inventoryRow('item_1', 'Aceite Vegetal 1L', 4, 'branch-1'),
    inventoryRow('item_1', 'Aceite Vegetal 1L', 7, 'branch-2'),
    inventoryRow('item_2', 'Arroz Oro', 10, 'branch-1'),
  ];

  it('returns one row per branch with a distinct branchId', async () => {
    dbMocks.inventoryFindMany.mockResolvedValue(MULTI_BRANCH_ROWS);

    const items = await repo.getInventory('tenant-1');

    expect(items).toHaveLength(3);
    expect(items.map((i) => i.branchId)).toEqual([
      'branch-1',
      'branch-2',
      'branch-1',
    ]);
    // Each branch row keeps ITS OWN stock: the duplicate is not collapsed, and
    // the two rows are distinguishable instead of looking identical.
    expect(items[0].stock).toBe(4);
    expect(items[1].stock).toBe(7);
  });

  it('identifies a stock row by (product id, branchId), never by id alone', async () => {
    dbMocks.inventoryFindMany.mockResolvedValue(MULTI_BRANCH_ROWS);

    const items = await repo.getInventory('tenant-1');

    // `id` stays the product id because catalog mutations resolve the item.
    // The pair is what makes the row unique: two branches, one product.
    expect(items.filter((i) => i.id === 'item_1')).toHaveLength(2);
    const pairs = items.map((i) => `${i.id}@${i.branchId}`);
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it('keeps the read tenant-scoped so no branch of another tenant can appear', async () => {
    dbMocks.inventoryFindMany.mockResolvedValue(MULTI_BRANCH_ROWS);

    await repo.getInventory('tenant-1');

    expect(dbMocks.inventoryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-1' } })
    );
  });

  it('ranks the duplicated product once per branch, not twice overall', async () => {
    dbMocks.inventoryFindMany.mockResolvedValue(MULTI_BRANCH_ROWS);
    dbMocks.saleItemGroupBy.mockResolvedValue([
      { itemId: 'item_1', _sum: { quantity: decimal(12) } },
    ]);

    const items = await repo.getInventory('tenant-1', 'velocity');

    // One product, one score: both of its branch rows carry the SAME
    // unitsSold30d and stay adjacent, ranked above the never-sold Arroz.
    expect(items.map((i) => i.unitsSold30d)).toEqual([12, 12, 0]);
    expect(items.map((i) => `${i.name}@${i.branchId}`)).toEqual([
      'Aceite Vegetal 1L@branch-1',
      'Aceite Vegetal 1L@branch-2',
      'Arroz Oro@branch-1',
    ]);
  });

  it('a higher-velocity product still outranks a product present in two branches', async () => {
    dbMocks.inventoryFindMany.mockResolvedValue(MULTI_BRANCH_ROWS);
    dbMocks.saleItemGroupBy.mockResolvedValue([
      { itemId: 'item_1', _sum: { quantity: decimal(3) } },
      { itemId: 'item_2', _sum: { quantity: decimal(50) } },
    ]);

    const items = await repo.getInventory('tenant-1', 'velocity');

    // Storing a product in two branches must not inflate its rank past a
    // genuinely faster mover: Arroz (50) leads even though Aceite has 2 rows.
    expect(items.map((i) => `${i.name}@${i.branchId}`)).toEqual([
      'Arroz Oro@branch-1',
      'Aceite Vegetal 1L@branch-1',
      'Aceite Vegetal 1L@branch-2',
    ]);
  });

  it('reports cost from the catalog while the branch cost model is still unbuilt', async () => {
    // `ItemBranchCost` (M1) lands in S2a, so `cost` here is still the item-level
    // catalog cost. Pinning it keeps S1a honest instead of inventing a
    // per-branch cost column that does not exist.
    dbMocks.inventoryFindMany.mockResolvedValue(MULTI_BRANCH_ROWS);

    const items = await repo.getInventory('tenant-1');

    expect(items.map((i) => i.cost)).toEqual([30, 30, 30]);
  });

  it('leaves lotControl undefined until the Item column lands in S3a', async () => {
    dbMocks.inventoryFindMany.mockResolvedValue(MULTI_BRANCH_ROWS);

    const items = await repo.getInventory('tenant-1');

    expect(items.every((i) => i.lotControl === undefined)).toBe(true);
  });
});
