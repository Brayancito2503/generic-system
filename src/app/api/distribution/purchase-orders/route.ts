import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth, requireTenantId } from '@/lib/session';
import { ApiError, handleApiError } from '@/lib/api-error';
import { noQueryParamsSchema } from '@/core/schemas/tenant';
import { createPurchaseOrderSchema } from '@/core/schemas/distribution';
import { PrismaDistributionRepository } from '@/infrastructure/db/repositories/prisma-distribution.repository';

const repository = new PrismaDistributionRepository();

export async function GET(request: NextRequest) {
  try {
    await requireApiAuth(['ACCOUNTANT', 'STAFF', 'TENANT_ADMIN']);
    const tenantId = await requireTenantId();
    if (!tenantId) throw new ApiError(401, 'No autorizado');

    const query = noQueryParamsSchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams.entries())
    );
    if (!query.success) throw new ApiError(400, 'Datos inválidos');

    const orders = await repository.getPurchaseOrders(tenantId);
    return NextResponse.json(orders);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireApiAuth(['STAFF', 'TENANT_ADMIN']);
    const tenantId = await requireTenantId();
    if (!tenantId) throw new ApiError(401, 'No autorizado');

    const body = await request.json();
    const parsed = createPurchaseOrderSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, 'Datos inválidos');

    const order = await repository.createPurchaseOrder(tenantId, parsed.data);
    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}