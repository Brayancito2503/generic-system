import { describe, expect, it, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const prismaMocks = vi.hoisted(() => ({
  userFindFirst: vi.fn(),
  userFindMany: vi.fn(),
  tenantFindUnique: vi.fn(),
}));

vi.mock('@/infrastructure/db/prisma', () => ({
  prisma: {
    user: {
      findFirst: prismaMocks.userFindFirst,
      findMany: prismaMocks.userFindMany,
    },
    tenant: {
      findUnique: prismaMocks.tenantFindUnique,
    },
  },
}));

import { POST } from './route';
import { hashPassword } from '@/lib/security';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session-token';

function jsonRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function userRow(overrides: Partial<{ tenantId: string; role: string; email: string }> = {}) {
  return {
    id: 'user-1',
    tenantId: 'tenant-1',
    role: 'TENANT_ADMIN',
    email: 'admin@example.com',
    person: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/auth/login — tenant activation gate (SUPER_ADMIN toggle contract)', () => {
  it('rejects admin login when the tenant is deactivated (403)', async () => {
    prismaMocks.userFindFirst.mockResolvedValue({
      ...userRow(),
      passwordHash: await hashPassword('Admin123!'),
    });
    prismaMocks.tenantFindUnique.mockResolvedValue({ active: false });

    const response = await POST(
      jsonRequest({ mode: 'admin', email: 'admin@example.com', password: 'Admin123!' })
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toContain('Tenant desactivado');
    // Deactivated tenant must not receive a session cookie.
    expect(response.cookies.get('gs_session')).toBeUndefined();
  });

  it('rejects POS (PIN) login from a deactivated tenant with a generic 401 (no tenant leak)', async () => {
    prismaMocks.userFindMany.mockResolvedValue([
      {
        ...userRow({ role: 'STAFF' }),
        passwordHash: await hashPassword('Cajero123!'),
        posPinHash: await hashPassword('1234'),
        tenant: { active: false },
      },
    ]);

    const response = await POST(jsonRequest({ mode: 'pos', pin: '1234' }));

    // PIN of an inactive tenant is never compared nor revealed: same generic
    // message as invalid credentials, and no session cookie is issued.
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Credenciales inválidas');
    expect(response.cookies.get(SESSION_COOKIE)).toBeUndefined();
  });

  it('allows admin login when the tenant is active (regression)', async () => {
    prismaMocks.userFindFirst.mockResolvedValue({
      ...userRow(),
      passwordHash: await hashPassword('Admin123!'),
    });
    prismaMocks.tenantFindUnique.mockResolvedValue({ active: true });

    const response = await POST(
      jsonRequest({ mode: 'admin', email: 'admin@example.com', password: 'Admin123!' })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    const cookie = response.cookies.get(SESSION_COOKIE);
    expect(cookie?.value).toBeTruthy();
    // Round-trip the signed session token to assert what the browser holds.
    const session = await verifySessionToken(cookie!.value);
    expect(session).not.toBeNull();
    expect(session?.role).toBe('TENANT_ADMIN');
    expect(session?.tenantId).toBe('tenant-1');
    expect(session?.userId).toBe('user-1');
  });
});