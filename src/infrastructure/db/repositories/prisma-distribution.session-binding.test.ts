import { describe, expect, it, beforeEach, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { PrismaDistributionRepository } from '@/infrastructure/db/repositories/prisma-distribution.repository';

// D11 — a sale derives its cash session from the AUTHENTICATED USER's branch.
// The client names nothing: no `sessionId`, no `branchId`, on either the sale or
// the cash-register open (design.md "D11"). The chain under test is
//   session.userId -> User.personId -> Employee.branchId -> that branch's single
//   OPEN session, with a single-branch fallback for today's cashier.
//
// The Prisma client is mocked at the db layer. The transaction client carries
// DISTINCT spies for the four methods D11-4/D11-7 assert on
// (`employee.findFirst`, `branch.findMany`, `cashSession.findFirst`,
// `cashSession.updateMany`), so a passing test PROVES the sale's resolution ran
// inside `$transaction` instead of before it. Sharing one object would make
// those assertions pass either way — the suite would pin nothing. The remaining
// delegates are shared, which is the pattern the existing sale suites use.
const dbMocks = vi.hoisted(() => ({
  // Outer client — `openCashSession` and the derived reads run outside a tx.
  employeeFindFirst: vi.fn(),
  branchFindMany: vi.fn(),
  branchFindFirst: vi.fn(),
  branchCreate: vi.fn(),
  cashSessionFindFirst: vi.fn(),
  cashSessionCreate: vi.fn(),
  itemFindMany: vi.fn(),
  itemFindFirst: vi.fn(),
  personFindFirst: vi.fn(),
  taxRateFindFirst: vi.fn(),
  saleCounterUpsert: vi.fn(),
  inventoryUpdateMany: vi.fn(),
  inventoryMovementCreate: vi.fn(),
  saleCreate: vi.fn(),
  receivableCreate: vi.fn(),
  userFindFirst: vi.fn(),
  // Transaction-only — a call here can only come from inside `$transaction`.
  txEmployeeFindFirst: vi.fn(),
  txBranchFindMany: vi.fn(),
  txCashSessionFindFirst: vi.fn(),
  txCashSessionUpdateMany: vi.fn(),
}));

vi.mock('@/infrastructure/db/prisma', () => {
  const tx = {
    employee: { findFirst: dbMocks.txEmployeeFindFirst },
    branch: { findMany: dbMocks.txBranchFindMany },
    cashSession: {
      findFirst: dbMocks.txCashSessionFindFirst,
      updateMany: dbMocks.txCashSessionUpdateMany,
    },
    item: { findMany: dbMocks.itemFindMany, findFirst: dbMocks.itemFindFirst },
    person: { findFirst: dbMocks.personFindFirst },
    taxRate: { findFirst: dbMocks.taxRateFindFirst },
    saleCounter: { upsert: dbMocks.saleCounterUpsert },
    inventory: { updateMany: dbMocks.inventoryUpdateMany },
    inventoryMovement: { create: dbMocks.inventoryMovementCreate },
    sale: { create: dbMocks.saleCreate },
    receivable: { create: dbMocks.receivableCreate },
    user: { findFirst: dbMocks.userFindFirst },
  };
  return {
    prisma: {
      // `...tx` first: the outer client's own employee/branch/cashSession
      // delegates must WIN, because those are the ones a call outside
      // `$transaction` reaches. Overriding them afterwards is what makes the
      // tx-only spies meaningful.
      ...tx,
      employee: { findFirst: dbMocks.employeeFindFirst },
      branch: {
        findMany: dbMocks.branchFindMany,
        findFirst: dbMocks.branchFindFirst,
        create: dbMocks.branchCreate,
      },
      cashSession: {
        findFirst: dbMocks.cashSessionFindFirst,
        create: dbMocks.cashSessionCreate,
      },
      $transaction: vi.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    },
  };
});

const repo = new PrismaDistributionRepository();
const decimal = (n: number) => new Prisma.Decimal(n);

const TENANT = 'tenant-1';

const BRANCH_A = { id: 'branch-a', name: 'Sucursal Central' };
const BRANCH_B = { id: 'branch-b', name: 'Sucursal Norte' };

/** An Employee whose branch belongs to the session tenant. */
function employeeAt(branch: { id: string; name: string } | null) {
  return {
    branchId: branch ? branch.id : null,
    branch: branch ? { id: branch.id, name: branch.name } : null,
  };
}

const SALE_ITEM = {
  id: 'item-1',
  tenantId: TENANT,
  name: 'Arroz',
  sku: 'ARZ-001',
  cost: decimal(30),
  price: decimal(40),
  saleUnit: null,
};

const OPEN_SESSION = {
  id: 'cash-b',
  tenantId: TENANT,
  status: 'OPEN',
  branchId: 'branch-b',
  notes: null,
};

const CREATED_SESSION = {
  id: 'cash-new',
  tenantId: TENANT,
  branchId: 'branch-b',
  employeeId: null,
  openedAt: new Date('2026-03-01T08:00:00.000Z'),
  openingAmount: decimal(500),
};

const SALE_INPUT = {
  lines: [{ itemId: 'item-1', quantity: 2 }],
  discount: 0,
  personId: null,
  notes: null,
  paymentMethod: 'CASH' as const,
  paidAmount: 80,
  userId: 'user-1',
};

function createdSale() {
  return {
    id: 'sale-1',
    tenantId: TENANT,
    cashSessionId: 'cash-b',
    personId: null,
    subtotal: decimal(80),
    taxAmount: decimal(0),
    discount: decimal(0),
    total: decimal(80),
    paymentMethod: 'CASH',
    paidAmount: decimal(80),
    balance: decimal(0),
    invoiceNumber: 'INV-20260301-000001',
    status: 'COMPLETED',
    createdAt: new Date('2026-03-01T09:00:00.000Z'),
    items: [
      {
        id: 'si-1',
        itemId: 'item-1',
        quantity: decimal(2),
        price: decimal(40),
        cost: decimal(30),
        item: SALE_ITEM,
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: the session user works at branch B, nothing is open anywhere, and
  // the tenant owns both branches. Each test overrides only what it exercises.
  dbMocks.employeeFindFirst.mockResolvedValue(employeeAt(BRANCH_B));
  dbMocks.txEmployeeFindFirst.mockResolvedValue(employeeAt(BRANCH_B));
  dbMocks.branchFindMany.mockResolvedValue([BRANCH_A, BRANCH_B]);
  dbMocks.txBranchFindMany.mockResolvedValue([BRANCH_A, BRANCH_B]);
  dbMocks.cashSessionFindFirst.mockResolvedValue(null);
  dbMocks.txCashSessionFindFirst.mockResolvedValue(null);
  dbMocks.cashSessionCreate.mockResolvedValue(CREATED_SESSION);
  dbMocks.txCashSessionUpdateMany.mockResolvedValue({ count: 1 });
  dbMocks.itemFindMany.mockResolvedValue([SALE_ITEM]);
  dbMocks.taxRateFindFirst.mockResolvedValue(null);
  dbMocks.saleCounterUpsert.mockResolvedValue({ lastNumber: 1 });
  dbMocks.inventoryUpdateMany.mockResolvedValue({ count: 1 });
  dbMocks.saleCreate.mockResolvedValue(createdSale());
});

describe('openCashSession — the branch is derived from the session user (D11)', () => {
  it('opens the register at the branch named by the user Employee record', async () => {
    const session = await repo.openCashSession(TENANT, {
      userId: 'user-1',
      openingAmount: 500,
      employeeId: null,
    });

    // The derivation walks session user -> Person -> Employee -> branch.
    expect(dbMocks.employeeFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: TENANT,
          person: { is: { user: { is: { id: 'user-1' } } } },
        }),
      })
    );
    // ...and the branch actually written is B, not A.
    expect(dbMocks.cashSessionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: TENANT, branchId: 'branch-b' }),
    });
    expect(session.branchId).toBe('branch-b');
  });

  it('tenant-guards the Employee -> Branch resolution inside the where clause (Rule #1)', async () => {
    await repo.openCashSession(TENANT, {
      userId: 'user-1',
      openingAmount: 500,
      employeeId: null,
    });

    // `Employee.branchId` has NO FK to `Branch.tenantId` (schema:378-379), so the
    // tenant filter on the branch relation is the ONLY thing stopping a foreign
    // branch from being read. Assert the predicate, not just the outcome.
    const where = dbMocks.employeeFindFirst.mock.calls[0][0].where;
    expect(where.tenantId).toBe(TENANT);
    expect(where.OR).toEqual([
      { branchId: null },
      { branch: { is: { tenantId: TENANT } } },
    ]);
  });

  it('falls back to the tenant only branch when the user has no Employee record (D11-1)', async () => {
    dbMocks.employeeFindFirst.mockResolvedValue(null);
    dbMocks.branchFindMany.mockResolvedValue([BRANCH_A]);

    await repo.openCashSession(TENANT, {
      userId: 'user-1',
      openingAmount: 500,
      employeeId: null,
    });

    // Backward compatibility: a single-branch tenant keeps today's behavior.
    // Assert the WRITE, not the mocked return value.
    expect(dbMocks.cashSessionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ branchId: 'branch-a' }),
    });
    // ...and the earliest-branch helper was never consulted on this path.
    expect(dbMocks.branchFindFirst).not.toHaveBeenCalled();
  });

  it('treats an Employee with a null branch exactly like no Employee record (D11-2)', async () => {
    dbMocks.employeeFindFirst.mockResolvedValue(employeeAt(null));
    dbMocks.branchFindMany.mockResolvedValue([BRANCH_A]);

    await repo.openCashSession(TENANT, {
      userId: 'user-1',
      openingAmount: 500,
      employeeId: null,
    });

    // The two "no derivable branch" shapes deliberately collapse to one fallback:
    // a cashier with no branch inside a single-branch store must still sell.
    expect(dbMocks.cashSessionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ branchId: 'branch-a' }),
    });
  });

  it('refuses to open a session when no branch is derivable and several exist', async () => {
    dbMocks.employeeFindFirst.mockResolvedValue(null);

    await expect(
      repo.openCashSession(TENANT, {
        userId: 'user-1',
        openingAmount: 500,
        employeeId: null,
      })
    ).rejects.toMatchObject({
      status: 400,
      message:
        'No se puede determinar la sucursal de la venta: asigna una sucursal al cajero o deja una sola sucursal',
    });

    // Guessing the earliest branch is exactly the wrong-branch risk D11 removes.
    expect(dbMocks.cashSessionCreate).not.toHaveBeenCalled();
  });

  it('reports a tenant with no branches at all with the existing message', async () => {
    dbMocks.employeeFindFirst.mockResolvedValue(null);
    dbMocks.branchFindMany.mockResolvedValue([]);

    await expect(
      repo.openCashSession(TENANT, {
        userId: 'user-1',
        openingAmount: 500,
        employeeId: null,
      })
    ).rejects.toMatchObject({
      status: 400,
      message: 'El tenant no tiene sucursales configuradas',
    });
    expect(dbMocks.cashSessionCreate).not.toHaveBeenCalled();
  });
});

describe('openCashSession — one OPEN session per BRANCH, not per tenant', () => {
  it('opens branch B while branch A already holds an open session', async () => {
    await repo.openCashSession(TENANT, {
      userId: 'user-1',
      openingAmount: 500,
      employeeId: null,
    });

    // The guard is per branch: branch A's OPEN row must not even be looked at.
    expect(dbMocks.cashSessionFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: TENANT,
          branchId: 'branch-b',
          status: 'OPEN',
        }),
      })
    );
    expect(dbMocks.cashSessionCreate).toHaveBeenCalledTimes(1);
  });

  it('rejects a second open session on the SAME branch with 409', async () => {
    dbMocks.cashSessionFindFirst.mockResolvedValue(OPEN_SESSION);

    await expect(
      repo.openCashSession(TENANT, {
        userId: 'user-1',
        openingAmount: 500,
        employeeId: null,
      })
    ).rejects.toMatchObject({ status: 409 });

    expect(dbMocks.cashSessionCreate).not.toHaveBeenCalled();
  });
});

describe('registerSale — the sale resolves its session at the derived branch (D11-3/D11-4/D11-8)', () => {
  it('resolves the branch and the session INSIDE the transaction', async () => {
    dbMocks.txCashSessionFindFirst.mockResolvedValue(OPEN_SESSION);

    await repo.registerSale(TENANT, SALE_INPUT);

    // Every one of these spies exists ONLY on the transaction client, so a call
    // proves the resolution ran inside `$transaction` — the design's whole point
    // being that the stock writes are authorized by a fact that cannot be
    // invalidated before they commit.
    expect(dbMocks.txEmployeeFindFirst).toHaveBeenCalled();
    expect(dbMocks.txBranchFindMany).not.toHaveBeenCalled(); // B came from Employee
    expect(dbMocks.txCashSessionFindFirst).toHaveBeenCalled();
    expect(dbMocks.txCashSessionUpdateMany).toHaveBeenCalled();
  });

  it('scopes the open-session lookup to the derived branch (D11-4)', async () => {
    dbMocks.txCashSessionFindFirst.mockResolvedValue(OPEN_SESSION);

    await repo.registerSale(TENANT, SALE_INPUT);

    // The old lookup was `{ tenantId, status: 'OPEN' }` with no branch, so with
    // two open registers it returned an arbitrary row.
    expect(dbMocks.txCashSessionFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: TENANT,
          branchId: 'branch-b',
          status: 'OPEN',
        }),
      })
    );
    // ...and the stock decrement runs at that same branch.
    expect(dbMocks.inventoryUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT, branchId: 'branch-b' }),
      })
    );
  });

  it('adds no orderBy to the session lookup (D11-5)', async () => {
    dbMocks.txCashSessionFindFirst.mockResolvedValue(OPEN_SESSION);

    await repo.registerSale(TENANT, SALE_INPUT);

    // M5's partial unique index makes `(tenantId, branchId) WHERE status='OPEN'`
    // hold at most one row. A sort here would let someone later relax M5 without
    // any test failing — so its ABSENCE is a regression guard, not an omission.
    const arg = dbMocks.txCashSessionFindFirst.mock.calls[0][0];
    expect(arg).not.toHaveProperty('orderBy');
    expect(arg).not.toHaveProperty('take');
  });

  it('names the derived branch when it has no open session', async () => {
    dbMocks.txCashSessionFindFirst.mockResolvedValue(null);

    await expect(repo.registerSale(TENANT, SALE_INPUT)).rejects.toMatchObject({
      status: 400,
      message:
        'Debe abrir la caja en la sucursal «Sucursal Norte» antes de registrar una venta',
    });

    expect(dbMocks.inventoryUpdateMany).not.toHaveBeenCalled();
    expect(dbMocks.saleCreate).not.toHaveBeenCalled();
  });

  it('refuses the whole sale when the branch cannot be derived (D11-3)', async () => {
    dbMocks.txEmployeeFindFirst.mockResolvedValue(null);
    // Two branches, no Employee row → the fallback must REFUSE, not guess.

    await expect(repo.registerSale(TENANT, SALE_INPUT)).rejects.toMatchObject({
      status: 400,
      message:
        'No se puede determinar la sucursal de la venta: asigna una sucursal al cajero o deja una sola sucursal',
    });

    // No session lookup at all, and above all no writes.
    expect(dbMocks.txCashSessionFindFirst).not.toHaveBeenCalled();
    expect(dbMocks.inventoryUpdateMany).not.toHaveBeenCalled();
    expect(dbMocks.saleCreate).not.toHaveBeenCalled();
  });

  it('tenant-guards the Employee -> Branch resolution inside the where clause (D11-8)', async () => {
    dbMocks.txCashSessionFindFirst.mockResolvedValue(OPEN_SESSION);

    await repo.registerSale(TENANT, SALE_INPUT);

    // `Employee.branchId` has NO FK to `Branch.tenantId`, so this predicate is
    // the only thing stopping a foreign branch from authorizing a stock write.
    const where = dbMocks.txEmployeeFindFirst.mock.calls[0][0].where;
    expect(where.tenantId).toBe(TENANT);
    expect(where.person).toEqual({ is: { user: { is: { id: 'user-1' } } } });
    expect(where.OR).toEqual([{ branchId: null }, { branch: { is: { tenantId: TENANT } } }]);
  });

  it('writes no stock when the session closes between the read and the claim', async () => {
    dbMocks.txCashSessionFindFirst.mockResolvedValue(OPEN_SESSION);
    // Step 3 read it as OPEN; step 4's guarded write finds it closed.
    dbMocks.txCashSessionUpdateMany.mockResolvedValue({ count: 0 });

    await expect(repo.registerSale(TENANT, SALE_INPUT)).rejects.toMatchObject({
      status: 400,
      message: 'La caja de «Sucursal Norte» se cerró mientras se registraba la venta',
    });

    // "No stock moves at all" — not even a partially-written document.
    expect(dbMocks.inventoryUpdateMany).not.toHaveBeenCalled();
    expect(dbMocks.inventoryMovementCreate).not.toHaveBeenCalled();
    expect(dbMocks.saleCounterUpsert).not.toHaveBeenCalled();
    expect(dbMocks.saleCreate).not.toHaveBeenCalled();
  });

  it('claims the session as the FIRST write of the transaction (D11-7)', async () => {
    dbMocks.txCashSessionFindFirst.mockResolvedValue(OPEN_SESSION);

    await repo.registerSale(TENANT, SALE_INPUT);

    // The claim takes a row lock held until commit, so it must precede every
    // stock write. `invocationCallOrder` is a global monotonic counter, so this
    // compares real execution order and not just "both were called".
    const claimOrder = dbMocks.txCashSessionUpdateMany.mock.invocationCallOrder[0];
    const stockOrder = dbMocks.inventoryUpdateMany.mock.invocationCallOrder[0];
    const saleOrder = dbMocks.saleCreate.mock.invocationCallOrder[0];

    expect(claimOrder).toBeLessThan(stockOrder);
    expect(claimOrder).toBeLessThan(saleOrder);
  });

  it('claims only the row it just read, guarded on tenant, branch and status', async () => {
    dbMocks.txCashSessionFindFirst.mockResolvedValue(OPEN_SESSION);

    await repo.registerSale(TENANT, SALE_INPUT);

    // A guarded `updateMany`, not `SELECT ... FOR UPDATE`: this repo uses no raw
    // SQL anywhere. Every predicate in the WHERE is what makes `count === 0` a
    // real answer instead of a hopeful one.
    expect(dbMocks.txCashSessionUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'cash-b',
        tenantId: TENANT,
        branchId: 'branch-b',
        status: 'OPEN',
      },
      data: { notes: null },
    });
  });
});
