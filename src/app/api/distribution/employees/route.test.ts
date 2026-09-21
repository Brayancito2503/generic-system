import { describe, expect, it, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { EmployeeEntity } from '@/core/entities/distribution';

// The employee routes are TENANT_ADMIN-only (access-role system): the mocked
// requireApiAuth enforces the passed role list against the active session
// role using the REAL ForbiddenError class so handleApiError maps it to 403.
const sessionMocks = vi.hoisted(() => ({
  active: { tenantId: 'tenant-1', role: 'STAFF' },
  requireApiAuth: vi.fn(),
  requireTenantId: vi.fn(),
}));

const repoMocks = vi.hoisted(() => ({
  getEmployees: vi.fn(),
  createEmployee: vi.fn(),
  linkEmployeeUser: vi.fn(),
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
    getEmployees = repoMocks.getEmployees;
    createEmployee = repoMocks.createEmployee;
    linkEmployeeUser = repoMocks.linkEmployeeUser;
  },
}));

import { GET, POST } from './route';

const EMPLOYEE: EmployeeEntity = {
  id: 'emp_1',
  tenantId: 'tenant-1',
  personId: 'per_1',
  firstName: 'Kevin',
  lastName: 'Mejía',
  email: 'kevin@example.com',
  phone: null,
  branchId: null,
  role: 'Cajero Principal',
  accessRole: 'CASHIER',
  department: 'Caja & Facturación',
  salary: 13000,
  commissionRate: 0.5,
  hireDate: new Date('2025-06-01T00:00:00.000Z'),
  isActive: true,
  createdAt: new Date('2025-06-01T00:00:00.000Z'),
};

function request(method: 'GET' | 'POST', body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/distribution/employees', {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
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
  repoMocks.getEmployees.mockResolvedValue([EMPLOYEE]);
  repoMocks.createEmployee.mockResolvedValue(EMPLOYEE);
  repoMocks.linkEmployeeUser.mockResolvedValue(EMPLOYEE);
});

describe('GET /api/distribution/employees (TENANT_ADMIN-only)', () => {
  it('rejects a STAFF session with 403 and never queries the repo', async () => {
    const response = await GET(request('GET'));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Permisos insuficientes' });
    expect(repoMocks.getEmployees).not.toHaveBeenCalled();
  });

  it('rejects a CASHIER/ACCOUNTANT session with 403 as well', async () => {
    for (const role of ['CASHIER', 'ACCOUNTANT']) {
      sessionMocks.active = { tenantId: 'tenant-1', role };
      const response = await GET(request('GET'));
      expect(response.status).toBe(403);
    }
  });

  it('returns the employee list for a TENANT_ADMIN session', async () => {
    sessionMocks.active = { tenantId: 'tenant-1', role: 'TENANT_ADMIN' };

    const response = await GET(request('GET'));

    expect(response.status).toBe(200);
    const body = (await response.json()) as EmployeeEntity[];
    expect(body).toHaveLength(1);
    // Tenant is never client input: derived from the authenticated session.
    expect(repoMocks.getEmployees).toHaveBeenCalledWith('tenant-1');
    // The access profile round-trips through the entity.
    expect(body[0].accessRole).toBe('CASHIER');
  });
});

describe('POST /api/distribution/employees (TENANT_ADMIN-only)', () => {
  it('rejects a STAFF session with 403 before validating the body', async () => {
    const response = await POST(request('POST', { firstName: 'Ana' }));

    expect(response.status).toBe(403);
    expect(repoMocks.createEmployee).not.toHaveBeenCalled();
  });

  it('creates an employee without a PIN, threading accessRole to the repo', async () => {
    sessionMocks.active = { tenantId: 'tenant-1', role: 'TENANT_ADMIN' };

    const response = await POST(
      request('POST', {
        firstName: 'Mario',
        lastName: 'Alvarado',
        role: 'Vendedor de Ruta',
        accessRole: 'CASHIER',
      })
    );

    expect(response.status).toBe(201);
    expect(repoMocks.createEmployee).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ accessRole: 'CASHIER' })
    );
    expect(repoMocks.linkEmployeeUser).not.toHaveBeenCalled();
  });

  it('creates with a PIN and links the User with the same accessRole', async () => {
    sessionMocks.active = { tenantId: 'tenant-1', role: 'TENANT_ADMIN' };

    const response = await POST(
      request('POST', {
        firstName: 'Kevin',
        lastName: 'Mejía',
        role: 'Cajero Principal',
        accessRole: 'CASHIER',
        pin: '1234',
      })
    );

    expect(response.status).toBe(201);
    expect(repoMocks.createEmployee).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ accessRole: 'CASHIER' })
    );
    expect(repoMocks.linkEmployeeUser).toHaveBeenCalledWith('tenant-1', 'emp_1', {
      pin: '1234',
      accessRole: 'CASHIER',
    });
  });

  it('rejects a malformed accessRole value with 400', async () => {
    sessionMocks.active = { tenantId: 'tenant-1', role: 'TENANT_ADMIN' };

    const response = await POST(
      request('POST', {
        firstName: 'Nadia',
        lastName: 'Luna',
        role: 'Gerente',
        accessRole: 'OWNER',
      })
    );

    expect(response.status).toBe(400);
    expect(repoMocks.createEmployee).not.toHaveBeenCalled();
  });
});