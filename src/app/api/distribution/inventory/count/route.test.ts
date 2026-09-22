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
  createInventoryCountBatch: vi.fn(),
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
    createInventoryCountBatch = repoMocks.createInventoryCountBatch;
  },
}));

import { POST } from './route';

const CREATE: InventoryAdjustmentEntity = {
  id: 'mov_2',
  tenantId: 'tenant-1',
  branchId: 'branch-1',
  itemId: 'item_1',
  itemName: 'Arroz',
  type: 'ADJUSTMENT',
  quantity: 3,
  reason: 'SOBRANTE',
  cost: 30,
  notes: 'Diferencia por conteo físico',
  userId: 'user_1',
  userName: 'Kevin Mejía',
  createdAt: new Date('2026-09-22T12:00:00.000Z'),
};

function request(body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/distribution/inventory/count', {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
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
  repoMocks.createInventoryCountBatch.mockResolvedValue([CREATE]);
});

describe('POST /api/distribution/inventory/count (physical count)', () => {
  it('rejects a STAFF session with 403 — a count writes the day merma', async () => {
    const response = await POST(
      request({ branchId: 'branch-1', items: [{ itemId: 'item_1', countedQuantity: 12 }] })
    );

    expect(response.status).toBe(403);
    expect(repoMocks.createInventoryCountBatch).not.toHaveBeenCalled();
  });

  it('posts a batch with diffs as 201 and threads the operator userId', async () => {
    sessionMocks.active = { tenantId: 'tenant-1', role: 'ACCOUNTANT', userId: 'user_1' };

    const response = await POST(
      request({
        branchId: 'branch-1',
        items: [{ itemId: 'item_1', countedQuantity: 18 }],
      })
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      created: InventoryAdjustmentEntity[];
      warning: boolean;
    };
    expect(body.created).toHaveLength(1);
    expect(body.warning).toBe(false);
    expect(repoMocks.createInventoryCountBatch).toHaveBeenCalledWith('tenant-1', {
      branchId: 'branch-1',
      items: [{ itemId: 'item_1', countedQuantity: 18 }],
      userId: 'user_1',
    });
  });

  it('returns 200 + warning when the whole batch matched the book', async () => {
    sessionMocks.active = active('TENANT_ADMIN');
    repoMocks.createInventoryCountBatch.mockResolvedValue([]);

    const response = await POST(
      request({ branchId: 'branch-1', items: [{ itemId: 'item_1', countedQuantity: 10 }] })
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { created: unknown[]; warning: boolean };
    expect(body.created).toEqual([]);
    expect(body.warning).toBe(true);
  });

  it('rejects an empty batch with 400 before touching the repo', async () => {
    sessionMocks.active = active('TENANT_ADMIN');

    const response = await POST(request({ branchId: 'branch-1', items: [] }));

    expect(response.status).toBe(400);
    expect(repoMocks.createInventoryCountBatch).not.toHaveBeenCalled();
  });

  it('rejects a negative counted quantity with 400', async () => {
    sessionMocks.active = active('TENANT_ADMIN');

    const response = await POST(
      request({ branchId: 'branch-1', items: [{ itemId: 'item_1', countedQuantity: -1 }] })
    );

    expect(response.status).toBe(400);
    expect(repoMocks.createInventoryCountBatch).not.toHaveBeenCalled();
  });
});