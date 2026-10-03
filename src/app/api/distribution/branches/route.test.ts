import { describe, expect, it, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { BranchEntity } from '@/core/entities/distribution';

// Branch routes (distribution-branches R1): reads are open to every
// distribution profile, writes are TENANT_ADMIN-only. The mocked
// requireApiAuth enforces the passed role list against the active session role
// using the REAL ForbiddenError class so handleApiError maps it to 403.
const sessionMocks = vi.hoisted(() => ({
  active: { tenantId: 'tenant-1', role: 'STAFF' },
  requireApiAuth: vi.fn(),
  requireTenantId: vi.fn(),
}));

const repoMocks = vi.hoisted(() => ({
  listBranches: vi.fn(),
  createBranch: vi.fn(),
  updateBranch: vi.fn(),
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
    listBranches = repoMocks.listBranches;
    createBranch = repoMocks.createBranch;
    updateBranch = repoMocks.updateBranch;
  },
}));

import { GET, POST } from './route';
import { PATCH } from './[id]/route';

const BRANCH: BranchEntity = {
  id: 'branch-1',
  tenantId: 'tenant-1',
  name: 'Sucursal Central',
  address: 'Managua, Nicaragua',
  createdAt: new Date('2026-01-05T00:00:00.000Z'),
};

/** The wire shape: `NextResponse.json` serializes dates to ISO strings. */
const BRANCH_JSON = { ...BRANCH, createdAt: BRANCH.createdAt.toISOString() };

function request(method: 'GET' | 'POST', body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/distribution/branches', {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function requestWithQuery(method: 'GET' | 'POST', query: string): NextRequest {
  return new NextRequest(`http://localhost/api/distribution/branches${query}`, {
    method,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionMocks.active = { tenantId: 'tenant-1', role: 'STAFF' };
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
  repoMocks.listBranches.mockResolvedValue([BRANCH]);
  repoMocks.createBranch.mockResolvedValue(BRANCH);
  repoMocks.updateBranch.mockResolvedValue(BRANCH);
});

describe('GET /api/distribution/branches (read: ACCOUNTANT, STAFF, TENANT_ADMIN)', () => {
  it('returns the branch list scoped to the session tenant', async () => {
    const response = await GET(request('GET'));

    expect(response.status).toBe(200);
    const body = (await response.json()) as BranchEntity[];
    expect(body).toHaveLength(1);
    expect(body[0]).toEqual(BRANCH_JSON);
    // The tenant is NEVER client input: it comes from the authenticated session.
    expect(repoMocks.listBranches).toHaveBeenCalledWith('tenant-1');
  });

  it('lets every distribution profile read the list', async () => {
    for (const role of ['ACCOUNTANT', 'STAFF', 'TENANT_ADMIN']) {
      sessionMocks.active = { tenantId: 'tenant-1', role };
      const response = await GET(request('GET'));
      expect(response.status).toBe(200);
    }
    expect(repoMocks.listBranches).toHaveBeenCalledTimes(3);
  });

  it('rejects a CASHIER session with 403 and never queries the repo', async () => {
    sessionMocks.active = { tenantId: 'tenant-1', role: 'CASHIER' };

    const response = await GET(request('GET'));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Permisos insuficientes' });
    expect(repoMocks.listBranches).not.toHaveBeenCalled();
  });

  it('rejects any query param with 400 (the route takes none)', async () => {
    const response = await GET(requestWithQuery('GET', '?tenantId=tenant-2'));

    expect(response.status).toBe(400);
    expect(repoMocks.listBranches).not.toHaveBeenCalled();
  });
});

describe('POST /api/distribution/branches (write: TENANT_ADMIN)', () => {
  it('rejects a non-admin session with 403 before validating the body', async () => {
    for (const role of ['CASHIER', 'ACCOUNTANT', 'STAFF']) {
      sessionMocks.active = { tenantId: 'tenant-1', role };
      const response = await POST(request('POST', { name: 'Sucursal Norte' }));
      expect(response.status).toBe(403);
    }
    expect(repoMocks.createBranch).not.toHaveBeenCalled();
  });

  it('creates a branch for the session tenant and returns 201', async () => {
    sessionMocks.active = { tenantId: 'tenant-1', role: 'TENANT_ADMIN' };

    const response = await POST(
      request('POST', { name: 'Sucursal Norte', address: 'Chinandega' })
    );

    expect(response.status).toBe(201);
    expect(repoMocks.createBranch).toHaveBeenCalledWith('tenant-1', {
      name: 'Sucursal Norte',
      address: 'Chinandega',
    });
    await expect(response.json()).resolves.toEqual(BRANCH_JSON);
  });

  it('ignores a client-supplied tenantId (non-strict schema strips it)', async () => {
    sessionMocks.active = { tenantId: 'tenant-1', role: 'TENANT_ADMIN' };

    const response = await POST(
      request('POST', { name: 'Sucursal Norte', tenantId: 'tenant-2' })
    );

    expect(response.status).toBe(201);
    // Exact-object match: a leaked `tenantId` would fail this assertion.
    expect(repoMocks.createBranch).toHaveBeenCalledWith('tenant-1', {
      name: 'Sucursal Norte',
      address: null,
    });
  });

  it('rejects a blank name with 400 and never reaches the repository', async () => {
    sessionMocks.active = { tenantId: 'tenant-1', role: 'TENANT_ADMIN' };

    const response = await POST(request('POST', { name: '   ' }));

    expect(response.status).toBe(400);
    expect(repoMocks.createBranch).not.toHaveBeenCalled();
  });
});

function patchRequest(body: unknown, id = 'branch-1'): NextRequest {
  return new NextRequest(`http://localhost/api/distribution/branches/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

const patchContext = (id: string) => ({ params: Promise.resolve({ id }) });

describe('PATCH /api/distribution/branches/[id] (write: TENANT_ADMIN)', () => {
  it('rejects a non-admin session with 403 before validating the body', async () => {
    for (const role of ['CASHIER', 'ACCOUNTANT', 'STAFF']) {
      sessionMocks.active = { tenantId: 'tenant-1', role };
      const response = await PATCH(patchRequest({ name: 'X' }), patchContext('branch-1'));
      expect(response.status).toBe(403);
    }
    expect(repoMocks.updateBranch).not.toHaveBeenCalled();
  });

  it('edits a branch and threads only the parsed fields to the repository', async () => {
    sessionMocks.active = { tenantId: 'tenant-1', role: 'TENANT_ADMIN' };

    const response = await PATCH(
      patchRequest({ name: 'Sucursal Renombrada' }),
      patchContext('branch-1')
    );

    expect(response.status).toBe(200);
    // Exact object: an omitted address must stay undefined, never null, or the
    // repository would clear a field the operator never named.
    expect(repoMocks.updateBranch).toHaveBeenCalledWith('tenant-1', 'branch-1', {
      name: 'Sucursal Renombrada',
    });
  });

  it('clears the address when the body sends an explicit null', async () => {
    sessionMocks.active = { tenantId: 'tenant-1', role: 'TENANT_ADMIN' };

    const response = await PATCH(
      patchRequest({ address: null }),
      patchContext('branch-1')
    );

    expect(response.status).toBe(200);
    expect(repoMocks.updateBranch).toHaveBeenCalledWith('tenant-1', 'branch-1', {
      address: null,
    });
  });

  it('ignores a client-supplied tenantId on the edit body', async () => {
    sessionMocks.active = { tenantId: 'tenant-1', role: 'TENANT_ADMIN' };

    const response = await PATCH(
      patchRequest({ name: 'Sucursal Sur', tenantId: 'tenant-2' }),
      patchContext('branch-1')
    );

    expect(response.status).toBe(200);
    expect(repoMocks.updateBranch).toHaveBeenCalledWith('tenant-1', 'branch-1', {
      name: 'Sucursal Sur',
    });
  });

  it('rejects an empty body with 400 and never reaches the repository', async () => {
    sessionMocks.active = { tenantId: 'tenant-1', role: 'TENANT_ADMIN' };

    const response = await PATCH(patchRequest({}), patchContext('branch-1'));

    expect(response.status).toBe(400);
    expect(repoMocks.updateBranch).not.toHaveBeenCalled();
  });

  it('rejects an empty id param with 400', async () => {
    sessionMocks.active = { tenantId: 'tenant-1', role: 'TENANT_ADMIN' };

    const response = await PATCH(patchRequest({ name: 'X' }), patchContext(''));

    expect(response.status).toBe(400);
    expect(repoMocks.updateBranch).not.toHaveBeenCalled();
  });

  it('surfaces a cross-tenant branch as 404 and writes nothing', async () => {
    sessionMocks.active = { tenantId: 'tenant-1', role: 'TENANT_ADMIN' };
    // The repository resolves the id under the session tenant; a foreign branch
    // is simply absent, so the edit never happens.
    const { ApiError } = await import('@/lib/api-error');
    repoMocks.updateBranch.mockRejectedValue(new ApiError(404, 'Sucursal no encontrada'));

    const response = await PATCH(
      patchRequest({ name: 'Secuestro' }),
      patchContext('branch-tenant-2')
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Sucursal no encontrada' });
    expect(repoMocks.updateBranch).toHaveBeenCalledWith(
      'tenant-1',
      'branch-tenant-2',
      { name: 'Secuestro' }
    );
  });
});
