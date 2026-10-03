import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth, requireTenantId } from '@/lib/session';
import { ApiError, handleApiError } from '@/lib/api-error';
import { noQueryParamsSchema } from '@/core/schemas/tenant';
import { PrismaDistributionRepository } from '@/infrastructure/db/repositories/prisma-distribution.repository';

const repository = new PrismaDistributionRepository();

export async function GET(request: NextRequest) {
  try {
    const session = await requireApiAuth(['CASHIER', 'ACCOUNTANT', 'STAFF', 'TENANT_ADMIN']);
    const tenantId = await requireTenantId();
    if (!tenantId) throw new ApiError(401, 'No autorizado');

    const query = noQueryParamsSchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams.entries())
    );
    if (!query.success) throw new ApiError(400, 'Datos inválidos');

    // D11: `userId` is threaded because the register figures are branch-derived,
    // so the panel reflects the viewer's own branch rather than whichever one a
    // tenant-wide lookup happened to return.
    const stats = await repository.getDashboard(tenantId, session.userId);
    return NextResponse.json(stats);
  } catch (error) {
    return handleApiError(error);
  }
}