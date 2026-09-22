import { describe, expect, it, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { InventoryMovementEntity } from '@/core/entities/distribution';

const sessionMocks = vi.hoisted(() => ({
  active: { tenantId: 'tenant-1', role: 'STAFF', userId: 'user_1' },
  requireApiAuth: vi.fn(),
  requireTenantId: vi.fn(),
}));

/** Session fixture factory: tenantId/userId are server-derived, never client input. */
const active = (role: string) => ({ tenantId: 'tenant-1', role, userId: 'user_1' });

const repoMocks = vi.hoisted(() => ({
  listInventoryMovements: vi.fn(),
}));

vi.mock('@/lib/session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/session')>();
  return {
    ...actual,
    requireApiAuth: sessionMocks.requireApiAuth,
    requireTenantId: sessionMocks.requireTenantId,
  };
});

vi.mock('@/infrastructure/db/repositories/prisma-distribution.repository', () => ({
  PrismaDistributionRepository: class {
    listInventoryMovements = repoMocks.listInventoryMovements;
  },
}));

import { GET } from './route';

const MOVEMENT: InventoryMovementEntity = {
  id: 'mov_1',
  tenantId: 'tenant-1',
  branchId: 'branch-1',
  itemId: 'item_1',
  itemName: 'Arroz',
  type: 'ADJUSTMENT',
  quantity: -2,
  reason: 'MERMA',
  costSnapshot: 30,
  notes: null,
  userId: 'user_1',
  userName: 'Kevin Mejía',
  refId: null,
  createdAt: new Date('2026-09-22T12:00:00.000Z'),
};

function getRequest(query = ''): NextRequest {
  return new NextRequest(
    `http://localhost/api/distribution/inventory/movements${query}`
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionMocks.active = active('STAFF');
  sessionMocks.requireApiAuth.mockImplementation(async (roles?: string[]) => {
    if (roles && sessionMocks.active.role !== 'SUPER_ADMIN') {
      const { ForbiddenError } = await import('@/lib/session');
      if (!roles.includes(sessionMocks.active.role)) {
        throw new ForbiddenError();
      }
    }
    return sessionMocks.active;
  });
  sessionMocks.requireTenantId.mockResolvedValue('tenant-1');
  repoMocks.listInventoryMovements.mockResolvedValue([MOVEMENT]);
});

describe('GET /api/distribution/inventory/movements (kardex)', () => {
  it('rejects a CASHIER session with 403 (cost snapshots are off the POS)', async () => {
    sessionMocks.active = active('CASHIER');

    const response = await GET(getRequest());

    expect(response.status).toBe(403);
    expect(repoMocks.listInventoryMovements).not.toHaveBeenCalled();
  });

  it('returns the ledger for an ACCOUNTANT session', async () => {
    sessionMocks.active = active('ACCOUNTANT');

    const response = await GET(getRequest());

    expect(response.status).toBe(200);
    const body = (await response.json()) as InventoryMovementEntity[];
    expect(body).toHaveLength(1);
    expect(body[0].type).toBe('ADJUSTMENT');
    // Tenant-scoped, never client input.
    expect(repoMocks.listInventoryMovements).toHaveBeenCalledWith('tenant-1', {});
  });

  it('converts strict YYYY-MM-DD filters into an America/Managua (UTC-6) window', async () => {
    sessionMocks.active = active('TENANT_ADMIN');

    const response = await GET(getRequest('?from=2026-09-01&to=2026-09-22'));

    expect(response.status).toBe(200);
    expect(repoMocks.listInventoryMovements).toHaveBeenCalledWith('tenant-1', {
      from: new Date('2026-09-01T00:00:00-06:00'),
      to: new Date('2026-09-22T23:59:59.999-06:00'),
    });
  });

  it('rejects a malformed date with 400 before querying the repo', async () => {
    sessionMocks.active = active('STAFF');

    const response = await GET(getRequest('?from=2026-13-99'));

    expect(response.status).toBe(400);
    expect(repoMocks.listInventoryMovements).not.toHaveBeenCalled();
  });

  it('rejects an unknown movement type with 400', async () => {
    sessionMocks.active = active('STAFF');

    const response = await GET(getRequest('?type=VIRTUAL'));

    expect(response.status).toBe(400);
    expect(repoMocks.listInventoryMovements).not.toHaveBeenCalled();
  });
});