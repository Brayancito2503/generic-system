import { describe, expect, it, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { DailyCloseReport } from '@/core/entities/distribution';

const sessionMocks = vi.hoisted(() => ({
  requireApiAuth: vi.fn(),
  requireTenantId: vi.fn(),
}));

const repoMocks = vi.hoisted(() => ({
  getDailyCloseReport: vi.fn(),
}));

// Auth helpers are mocked so the suite exercises the route contract in
// isolation; the real UnauthorizedError/ForbiddenError classes are preserved
// via the spread for handleApiError's instanceof checks.
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
    getDailyCloseReport = repoMocks.getDailyCloseReport;
  },
}));

import { GET } from './route';

const FIXTURE: DailyCloseReport = {
  date: '2026-09-20',
  lines: [
    {
      itemName: 'Arroz',
      uom: 'lb',
      quantity: 10,
      costUnit: 30,
      priceUnit: 40,
      lineCost: 300,
      lineRevenue: 400,
      margin: 100,
    },
  ],
  totals: { cost: 300, revenue: 400, margin: 100, taxAmount: 52.17, discount: 0 },
  paymentBreakdown: [{ method: 'CASH', count: 2, total: 450 }],
  collections: [
    {
      customerName: 'Juan Pérez',
      amount: 120,
      method: 'CASH',
      createdAt: '2026-09-20T18:30:00.000Z',
    },
  ],
  collectionsTotal: 120,
};

function getRequest(query: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/distribution/reports/daily-close${query}`
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionMocks.requireApiAuth.mockResolvedValue({
    tenantId: 'tenant-1',
    role: 'TENANT_ADMIN',
  });
  sessionMocks.requireTenantId.mockResolvedValue('tenant-1');
  repoMocks.getDailyCloseReport.mockResolvedValue(FIXTURE);
});

describe('GET /api/distribution/reports/daily-close', () => {
  it('rejects a missing/invalid date param with 400 and never queries the repo', async () => {
    for (const query of ['', '?date=', '?date=abc', '?date=2026/09/20']) {
      const response = await GET(getRequest(query));
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Datos inválidos');
    }
    expect(repoMocks.getDailyCloseReport).not.toHaveBeenCalled();
  });

  it('rejects a calendar-impossible date (2026-02-31) with 400', async () => {
    const response = await GET(getRequest('?date=2026-02-31'));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Datos inválidos');
    expect(repoMocks.getDailyCloseReport).not.toHaveBeenCalled();
  });

  it('returns the report for a valid date with the correct shape', async () => {
    const response = await GET(getRequest('?date=2026-09-20'));

    expect(response.status).toBe(200);
    const body = (await response.json()) as DailyCloseReport;
    expect(body.date).toBe('2026-09-20');
    expect(body.lines).toHaveLength(1);
    expect(body.lines[0]).toMatchObject({
      itemName: 'Arroz',
      quantity: 10,
      lineCost: 300,
      lineRevenue: 400,
      margin: 100,
    });
    expect(body.totals).toEqual({
      cost: 300,
      revenue: 400,
      margin: 100,
      taxAmount: 52.17,
      discount: 0,
    });
    expect(body.paymentBreakdown[0]).toEqual({
      method: 'CASH',
      count: 2,
      total: 450,
    });
    expect(body.collections[0].customerName).toBe('Juan Pérez');
    expect(body.collectionsTotal).toBe(120);

    // Tenant is never client input: derived from the authenticated session.
    expect(repoMocks.getDailyCloseReport).toHaveBeenCalledWith('tenant-1', '2026-09-20');
  });
});