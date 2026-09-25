import { describe, expect, it, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { InventoryStockItem } from '@/core/entities/distribution';

// Guard matrix under test (source of truth is route.ts):
//   GET  /inventory : CASHIER, STAFF, TENANT_ADMIN, ACCOUNTANT (read-only adds
//                     the accounting profile, which runs the physical count)
//   POST /inventory : CASHIER, STAFF, TENANT_ADMIN (ACCOUNTANT must NOT create)
// The mocked requireApiAuth enforces the passed role list against the active
// session role with the REAL ForbiddenError so handleApiError maps it to 403.
const sessionMocks = vi.hoisted(() => ({
  active: { tenantId: 'tenant-1', role: 'STAFF', userId: 'user_1' },
  requireApiAuth: vi.fn(),
  requireTenantId: vi.fn(),
}));

const repoMocks = vi.hoisted(() => ({
  getInventory: vi.fn(),
  createInventoryItem: vi.fn(),
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
    getInventory = repoMocks.getInventory;
    createInventoryItem = repoMocks.createInventoryItem;
  },
}));

import { GET, POST } from './route';

/** Session fixture factory: tenantId/userId are server-derived, never client input. */
const active = (role: string) => ({ tenantId: 'tenant-1', role, userId: 'user_1' });

const ITEM: InventoryStockItem = {
  id: 'item_1',
  tenantId: 'tenant-1',
  sku: 'SKU-1',
  name: 'Proteína 5lb',
  description: null,
  cost: 2500,
  price: 3200,
  stock: 14,
  minAlert: 5,
  isLowStock: false,
  saleUnit: 'LIBRA',
  unitsSold30d: 42,
};

function request(method: 'GET' | 'POST', body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/distribution/inventory', {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/** GET with a query string, to exercise the `sort` contract (Fase 2 Slice C). */
function listRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/distribution/inventory?${query}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionMocks.active = active('STAFF');
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
  repoMocks.getInventory.mockResolvedValue([ITEM]);
  repoMocks.createInventoryItem.mockResolvedValue(ITEM);
});

describe('GET /api/distribution/inventory (guard matrix)', () => {
  it('allows the ACCOUNTANT profile to read the list (count feature needs book stock)', async () => {
    sessionMocks.active = active('ACCOUNTANT');

    const response = await GET(request('GET'));

    expect(response.status).toBe(200);
    const body = (await response.json()) as InventoryStockItem[];
    expect(body).toHaveLength(1);
    // Tenant is never client input: derived from the authenticated session.
    // An absent `sort` resolves to the historical 'name' ordering.
    expect(repoMocks.getInventory).toHaveBeenCalledWith('tenant-1', 'name');
  });

  it('allows CASHIER, STAFF and TENANT_ADMIN as before', async () => {
    for (const role of ['CASHIER', 'STAFF', 'TENANT_ADMIN']) {
      sessionMocks.active = active(role);
      const response = await GET(request('GET'));
      expect(response.status).toBe(200);
    }
    expect(repoMocks.getInventory).toHaveBeenCalledTimes(3);
  });

  it('rejects an unknown profile with 403 and never queries the repo', async () => {
    sessionMocks.active = active('SUPERVISOR');

    const response = await GET(request('GET'));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Permisos insuficientes' });
    expect(repoMocks.getInventory).not.toHaveBeenCalled();
  });
});

describe('GET /api/distribution/inventory ?sort= (Fase 2 Slice C)', () => {
  it('defaults to the historical alphabetical ordering when no sort is sent', async () => {
    const response = await GET(request('GET'));

    expect(response.status).toBe(200);
    expect(repoMocks.getInventory).toHaveBeenCalledWith('tenant-1', 'name');
  });

  it('threads an explicit sort=velocity into the repository', async () => {
    const response = await GET(listRequest('sort=velocity'));

    expect(response.status).toBe(200);
    expect(repoMocks.getInventory).toHaveBeenCalledWith('tenant-1', 'velocity');
  });

  it('accepts the explicit sort=name as the default ordering', async () => {
    const response = await GET(listRequest('sort=name'));

    expect(response.status).toBe(200);
    expect(repoMocks.getInventory).toHaveBeenCalledWith('tenant-1', 'name');
  });

  it('rejects an invalid sort value with 400 and never queries the repo', async () => {
    const response = await GET(listRequest('sort=stock'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Datos inválidos' });
    expect(repoMocks.getInventory).not.toHaveBeenCalled();
  });

  it('rejects a sort injection attempt (arbitrary orderBy) with 400', async () => {
    const response = await GET(listRequest('sort=name&orderBy=stock'));

    expect(response.status).toBe(400);
    expect(repoMocks.getInventory).not.toHaveBeenCalled();
  });

  it('keeps returning the 30-day units-sold signal in the payload', async () => {
    repoMocks.getInventory.mockResolvedValue([
      { ...ITEM, id: 'item_1', unitsSold30d: 42 },
      { ...ITEM, id: 'item_2', name: 'Arroz Oro', unitsSold30d: 0 },
    ]);

    const response = await GET(listRequest('sort=velocity'));

    expect(response.status).toBe(200);
    const body = (await response.json()) as InventoryStockItem[];
    expect(body.map((i) => i.unitsSold30d)).toEqual([42, 0]);
  });
});

describe('POST /api/distribution/inventory (create, ACCOUNTANT excluded)', () => {
  it('rejects an ACCOUNTANT session with 403 before validating the body', async () => {
    sessionMocks.active = active('ACCOUNTANT');

    const response = await POST(request('POST', { name: 'Proteína 5lb' }));

    expect(response.status).toBe(403);
    expect(repoMocks.createInventoryItem).not.toHaveBeenCalled();
  });

  it('creates from a CASHIER session, threading tenantId and the operator userId', async () => {
    sessionMocks.active = active('CASHIER');

    const response = await POST(
      request('POST', {
        sku: 'SKU-1',
        name: 'Proteína 5lb',
        description: '',
        cost: 2500,
        price: 3200,
        stock: 14,
        minAlert: 5,
      })
    );

    expect(response.status).toBe(201);
    expect(repoMocks.createInventoryItem).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ name: 'Proteína 5lb', userId: 'user_1' })
    );
  });

  it('threads an optional saleUnit (Fase 2 Slice B) into the repository call', async () => {
    const response = await POST(
      request('POST', {
        sku: 'SKU-2',
        name: 'Arroz Oro',
        description: '',
        cost: 30,
        price: 45,
        stock: 100,
        minAlert: 5,
        saleUnit: 'LIBRA',
      })
    );

    expect(response.status).toBe(201);
    expect(repoMocks.createInventoryItem).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ saleUnit: 'LIBRA' })
    );
  });

  it('rejects an unknown sale unit with 400 before touching the repo', async () => {
    const response = await POST(
      request('POST', {
        sku: 'SKU-3',
        name: 'Arroz Oro',
        cost: 30,
        price: 45,
        stock: 100,
        minAlert: 5,
        saleUnit: 'KILOS',
      })
    );

    expect(response.status).toBe(400);
    expect(repoMocks.createInventoryItem).not.toHaveBeenCalled();
  });
});