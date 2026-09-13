import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth, requireTenantId } from '@/lib/session';
import { ApiError, handleApiError } from '@/lib/api-error';
import { createSaleReturnSchema, idParamSchema } from '@/core/schemas/distribution';
import { PrismaDistributionRepository } from '@/infrastructure/db/repositories/prisma-distribution.repository';

const repository = new PrismaDistributionRepository();

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireApiAuth(['STAFF', 'TENANT_ADMIN']);
    const tenantId = await requireTenantId();
    if (!tenantId) throw new ApiError(401, 'No autorizado');

    const { id } = await context.params;
    const saleId = idParamSchema.safeParse(id);
    if (!saleId.success) throw new ApiError(400, 'Datos inválidos');

    const body: unknown = await request.json();
    const parsed = createSaleReturnSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, 'Datos inválidos');

    // Over-return (409) and receivable overpay-edge (409) propagate untouched
    // through handleApiError; stock restore and the audit trail are one tx.
    const saleReturn = await repository.createSaleReturn(tenantId, id, {
      items: parsed.data.items,
      reason: parsed.data.reason ?? null,
    });
    return NextResponse.json(saleReturn, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}