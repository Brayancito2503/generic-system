import { describe, expect, it, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { InventoryAdjustmentEntity } from '@/core/entities/distribution';

const sessionMocks = vi.hoisted(() => ({
  active: { tenantId: 'tenant-1', role: 'STAFF', userId: 'user_1' },
  requireApiAuth: vi.fn(),
  requireTenantId: vi.fn(),
}));

/** Session fixture factory: tenantId/userId are server-derived, never client input. */
const active = (role: string) => ({ tenantId: 'tenant-1', role, userId: 'user_1' });

const repoMocks = vi.hoisted(() => ({
  listInventoryMovements: vi.fn(),
  createInventoryAdjustment: vi.fn(),
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
    createInventoryAdjustment = repoMocks.createInventoryAdjustment;
  },
}));

import { GET, POST } from './route';

const ADJUSTMENT: InventoryAdjustmentEntity = {
  id: 'mov_1',
  tenantId: 'tenant-1',
  branchId: 'branch-1',
  itemId: 'item_1',
  itemName: 'Arroz',
  type: 'ADJUSTMENT',
  quantity: -2,
  reason: 'MERMA',
  cost: 30,
  notes: null,
  userId: 'user_1',
  userName: 'Kevin Mejía',
  createdAt: new Date('2026-09-22T12:00:00.000Z'),
};

function request(method: 'GET' | 'POST', body?: unknown, query = ''): NextRequest {
  return new NextRequest(
    `http://localhost/api/distribution/inventory/adjustments${query}`,
    {
      method,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionMocks.active = { tenantId: 'tenant-1', role: 'STAFF', userId: 'user_1' };
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
  repoMocks.listInventoryMovements.mockResolvedValue([ADJUSTMENT]);
  repoMocks.createInventoryAdjustment.mockResolvedValue(ADJUSTMENT);
});

describe('GET /api/distribution/inventory/adjustments (history)', () => {
  it('rejects a CASHIER session with 403', async () => {
    sessionMocks.active = active('CASHIER');

    const response = await GET(request('GET'));

    expect(response.status).toBe(403);
    expect(repoMocks.listInventoryMovements).not.toHaveBeenCalled();
  });

  it('filters strictly to ADJUSTMENT rows, keeping tenant scope', async () => {
    sessionMocks.active = active('ACCOUNTANT');

    const response = await GET(request('GET', undefined, '?branchId=branch-1'));

    expect(response.status).toBe(200);
    expect(repoMocks.listInventoryMovements).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ type: 'ADJUSTMENT' })
    );
  });
});

describe('POST /api/distribution/inventory/adjustments (write)', () => {
  it('rejects a STAFF session with 403 — adjustments hit the day P&L', async () => {
    const response = await POST(
      request('POST', { branchId: 'branch-1', itemId: 'item_1', quantity: -2, reason: 'MERMA' })
    );

    expect(response.status).toBe(403);
    expect(repoMocks.createInventoryAdjustment).not.toHaveBeenCalled();
  });

  it('creates the adjustment and threads the operator userId', async () => {
    sessionMocks.active = { tenantId: 'tenant-1', role: 'ACCOUNTANT', userId: 'user_1' };

    const response = await POST(
      request('POST', {
        branchId: 'branch-1',
        itemId: 'item_1',
        quantity: -2,
        reason: 'MERMA',
        notes: 'Caja dañada',
      })
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as InventoryAdjustmentEntity;
    expect(body.reason).toBe('MERMA');
    expect(repoMocks.createInventoryAdjustment).toHaveBeenCalledWith('tenant-1', {
      branchId: 'branch-1',
      itemId: 'item_1',
      quantity: -2,
      reason: 'MERMA',
      notes: 'Caja dañada',
      userId: 'user_1',
    });
  });

  it('rejects a zero quantity with 400 before touching the repo', async () => {
    sessionMocks.active = active('TENANT_ADMIN');

    const response = await POST(
      request('POST', { branchId: 'branch-1', itemId: 'item_1', quantity: 0, reason: 'DESCUADRE' })
    );

    expect(response.status).toBe(400);
    expect(repoMocks.createInventoryAdjustment).not.toHaveBeenCalled();
  });

  it('rejects an unknown reason with 400 — sign convention stays server-side', async () => {
    sessionMocks.active = active('TENANT_ADMIN');

    const response = await POST(
      request('POST', { branchId: 'branch-1', itemId: 'item_1', quantity: -2, reason: 'HURTO' })
    );

    expect(response.status).toBe(400);
    expect(repoMocks.createInventoryAdjustment).not.toHaveBeenCalled();
  });
});