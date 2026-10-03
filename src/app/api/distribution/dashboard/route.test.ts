import { describe, expect, it, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// The dashboard's register figures are branch-derived (D11), so this route is
// where the session user's identity has to stop being discarded. These tests pin
// that `requireApiAuth`'s payload actually reaches the repository.
const sessionMocks = vi.hoisted(() => ({
  active: { userId: 'user-1', tenantId: 'tenant-1', role: 'TENANT_ADMIN' },
  requireApiAuth: vi.fn(),
  requireTenantId: vi.fn(),
}));

const repoMocks = vi.hoisted(() => ({
  getDashboard: vi.fn(),
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
    getDashboard = repoMocks.getDashboard;
  },
}));

import { GET } from './route';

function request(url = 'http://localhost/api/distribution/dashboard'): NextRequest {
  return new NextRequest(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionMocks.active = { userId: 'user-1', tenantId: 'tenant-1', role: 'TENANT_ADMIN' };
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
  repoMocks.getDashboard.mockResolvedValue({ salesToday: 0 });
});

describe('GET /api/distribution/dashboard', () => {
  it('threads the session userId so the register panel is branch-derived', async () => {
    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(repoMocks.getDashboard).toHaveBeenCalledWith('tenant-1', 'user-1');
  });

  it('rejects a client-supplied branchId instead of forwarding it (400)', async () => {
    const response = await GET(
      request('http://localhost/api/distribution/dashboard?branchId=branch-b')
    );

    // Stronger than "ignored": the route takes no query params at all, so a
    // client cannot even express a branch here.
    expect(response.status).toBe(400);
    expect(repoMocks.getDashboard).not.toHaveBeenCalled();
  });

  it('rejects a role outside the dashboard profiles with 403', async () => {
    sessionMocks.active = { userId: 'user-1', tenantId: 'tenant-1', role: 'CUSTOMER' };

    const response = await GET(request());

    expect(response.status).toBe(403);
    expect(repoMocks.getDashboard).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated request with 401', async () => {
    const { UnauthorizedError } = await import('@/lib/session');
    sessionMocks.requireApiAuth.mockRejectedValue(new UnauthorizedError());

    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(repoMocks.getDashboard).not.toHaveBeenCalled();
  });
});