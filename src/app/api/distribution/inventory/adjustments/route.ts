import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth, requireTenantId } from '@/lib/session';
import { ApiError, handleApiError } from '@/lib/api-error';
import {
  createInventoryAdjustmentSchema,
  listMovementsQuerySchema,
} from '@/core/schemas/distribution';
import { PrismaDistributionRepository } from '@/infrastructure/db/repositories/prisma-distribution.repository';

const repository = new PrismaDistributionRepository();

/**
 * Manual stock adjustments (merma / rotura / vencimiento / descuadre /
 * sobrante). GET is read-only for the shop-floor snapshot; POST is restricted
 * to ACCOUNTANT/TENANT_ADMIN — the adjustment writes a loss to the day's P&L.
 */
export async function GET(request: NextRequest) {
  try {
    await requireApiAuth(['ACCOUNTANT', 'STAFF', 'TENANT_ADMIN']);
    const tenantId = await requireTenantId();
    if (!tenantId) throw new ApiError(401, 'No autorizado');

    const query = listMovementsQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams.entries())
    );
    if (!query.success) throw new ApiError(400, 'Datos inválidos');

    const filter = {
      ...(query.data.branchId ? { branchId: query.data.branchId } : {}),
      ...(query.data.itemId ? { itemId: query.data.itemId } : {}),
      reason: query.data.reason,
      type: 'ADJUSTMENT' as const,
      ...(query.data.from ? { from: new Date(`${query.data.from}T00:00:00-06:00`) } : {}),
      ...(query.data.to ? { to: new Date(`${query.data.to}T23:59:59.999-06:00`) } : {}),
    };

    const adjustments = await repository.listInventoryMovements(tenantId, filter);
    return NextResponse.json(adjustments);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiAuth(['ACCOUNTANT', 'TENANT_ADMIN']);
    const tenantId = await requireTenantId();
    if (!tenantId) throw new ApiError(401, 'No autorizado');

    const body: unknown = await request.json();
    const parsed = createInventoryAdjustmentSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, 'Datos inválidos');

    // Sign-vs-reason mismatches (400) and insufficient stock (409) come from
    // the repository and propagate untouched through handleApiError.
    const adjustment = await repository.createInventoryAdjustment(tenantId, {
      branchId: parsed.data.branchId,
      itemId: parsed.data.itemId,
      quantity: parsed.data.quantity,
      reason: parsed.data.reason,
      notes: parsed.data.notes ?? null,
      // Operator of the ADJUSTMENT ledger row.
      userId: session.userId,
    });

    return NextResponse.json(adjustment, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}