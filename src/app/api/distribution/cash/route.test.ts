import { describe, expect, it, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { CashSessionEntity } from '@/core/entities/distribution';

// Cash-register routes (distribution-cash-register R1/R2 — the D11 amendment):
// the register's branch is DERIVED from the session user, never named by the
// client. These tests pin the route half of that: `session.userId` reaches the
// repository, and a client-supplied `branchId` cannot.
const sessionMocks = vi.hoisted(() => ({
  active: { userId: 'user-1', tenantId: 'tenant-1', role: 'STAFF' },
  requireApiAuth: vi.fn(),
  requireTenantId: vi.fn(),
}));

const repoMocks = vi.hoisted(() => ({
  getOpenCashSession: vi.fn(),
  openCashSession: vi.fn(),
  addCashMovement: vi.fn(),
  closeCashSession: vi.fn(),
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
    getOpenCashSession = repoMocks.getOpenCashSession;
    openCashSession = repoMocks.openCashSession;
    addCashMovement = repoMocks.addCashMovement;
    closeCashSession = repoMocks.closeCashSession;
  },
}));

import { GET, POST } from './route';

const SESSION: CashSessionEntity = {
  id: 'cash-1',
  tenantId: 'tenant-1',
  branchId: 'branch-b',
  employeeId: 'emp-1',
  openedAt: new Date('2026-03-01T08:00:00.000Z'),
  openingAmount: 500,
  status: 'OPEN',
  movements: [],
  salesTotal: 0,
};

function request(method: 'GET' | 'POST', body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/distribution/cash', {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionMocks.active = { userId: 'user-1', tenantId: 'tenant-1', role: 'STAFF' };
  // Mirror the real requireApiAuth contract: SUPER_ADMIN bypass, otherwise the
  // role must be in the allowed list or a ForbiddenError is thrown.
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
  repoMocks.getOpenCashSession.mockResolvedValue(SESSION);
  repoMocks.openCashSession.mockResolvedValue(SESSION);
});

describe('POST /api/distribution/cash — the register branch is derived, not named', () => {
  it('forwards the session userId so the repository can derive the branch', async () => {
    const response = await POST(request('POST', { openingAmount: 500 }));

    expect(response.status).toBe(201);
    // Exact object: a leaked client `branchId` would fail this assertion, which
    // is the whole point — the request body must not be able to name a branch.
    expect(repoMocks.openCashSession).toHaveBeenCalledWith('tenant-1', {
      openingAmount: 500,
      employeeId: null,
      userId: 'user-1',
    });
  });

  it('ignores a client-supplied branchId (older clients keep working)', async () => {
    const response = await POST(
      request('POST', { openingAmount: 500, branchId: 'branch-of-another-tenant' })
    );

    expect(response.status).toBe(201);
    expect(repoMocks.openCashSession).toHaveBeenCalledWith('tenant-1', {
      openingAmount: 500,
      employeeId: null,
      userId: 'user-1',
    });
  });

  it('rejects a negative opening amount with 400 and never reaches the repository', async () => {
    const response = await POST(request('POST', { openingAmount: -1 }));

    expect(response.status).toBe(400);
    expect(repoMocks.openCashSession).not.toHaveBeenCalled();
  });

  it('rejects a body with no opening amount with 400', async () => {
    const response = await POST(request('POST', {}));

    expect(response.status).toBe(400);
    expect(repoMocks.openCashSession).not.toHaveBeenCalled();
  });

  it('surfaces a second open session on the same branch as 409', async () => {
    const { ApiError } = await import('@/lib/api-error');
    repoMocks.openCashSession.mockRejectedValue(
      new ApiError(409, 'Ya existe una sesión de caja abierta')
    );

    const response = await POST(request('POST', { openingAmount: 500 }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'Ya existe una sesión de caja abierta',
    });
  });

  it('surfaces an unresolvable branch as 400 with the configuration message', async () => {
    const { ApiError } = await import('@/lib/api-error');
    repoMocks.openCashSession.mockRejectedValue(
      new ApiError(
        400,
        'No se puede determinar la sucursal de la venta: asigna una sucursal al cajero o deja una sola sucursal'
      )
    );

    const response = await POST(request('POST', { openingAmount: 500 }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error:
        'No se puede determinar la sucursal de la venta: asigna una sucursal al cajero o deja una sola sucursal',
    });
  });

  it('rejects an unauthenticated request with 401 before touching the repository', async () => {
    const { UnauthorizedError } = await import('@/lib/session');
    sessionMocks.requireApiAuth.mockRejectedValue(new UnauthorizedError());

    const response = await POST(request('POST', { openingAmount: 500 }));

    expect(response.status).toBe(401);
    expect(repoMocks.openCashSession).not.toHaveBeenCalled();
  });
});

describe('GET /api/distribution/cash', () => {
  it('reads the register at the caller own branch (D11)', async () => {
    const response = await GET(request('GET'));

    expect(response.status).toBe(200);
    // `userId` is the whole point: without it the read would fall back to an
    // arbitrary open register, which is the defect D11 removes.
    expect(repoMocks.getOpenCashSession).toHaveBeenCalledWith('tenant-1', 'user-1');
  });

  it('rejects a role outside the cash-register profile with 403', async () => {
    sessionMocks.active = { userId: 'user-1', tenantId: 'tenant-1', role: 'CUSTOMER' };

    const response = await GET(request('GET'));

    expect(response.status).toBe(403);
    expect(repoMocks.getOpenCashSession).not.toHaveBeenCalled();
  });

  it('rejects any query param with 400 (the branch is never client input)', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/distribution/cash?branchId=branch-b')
    );

    expect(response.status).toBe(400);
    expect(repoMocks.getOpenCashSession).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated request with 401', async () => {
    const { UnauthorizedError } = await import('@/lib/session');
    sessionMocks.requireApiAuth.mockRejectedValue(new UnauthorizedError());

    const response = await GET(request('GET'));

    expect(response.status).toBe(401);
    expect(repoMocks.getOpenCashSession).not.toHaveBeenCalled();
  });
});
