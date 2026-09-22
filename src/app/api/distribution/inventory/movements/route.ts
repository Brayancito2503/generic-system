import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth, requireTenantId } from '@/lib/session';
import { ApiError, handleApiError } from '@/lib/api-error';
import { listMovementsQuerySchema } from '@/core/schemas/distribution';
import { PrismaDistributionRepository } from '@/infrastructure/db/repositories/prisma-distribution.repository';

const repository = new PrismaDistributionRepository();

/**
 * Ledger (kardex) list. ACCOUNTANT/STAFF/TENANT_ADMIN only: it exposes unit
 * cost snapshots that must stay out of the CASHIER POS surface.
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
      ...(query.data.type ? { type: query.data.type } : {}),
      ...(query.data.reason ? { reason: query.data.reason } : {}),
      ...(query.data.from ? { from: new Date(`${query.data.from}T00:00:00-06:00`) } : {}),
      ...(query.data.to ? { to: new Date(`${query.data.to}T23:59:59.999-06:00`) } : {}),
    };

    const movements = await repository.listInventoryMovements(tenantId, filter);
    return NextResponse.json(movements);
  } catch (error) {
    return handleApiError(error);
  }
}