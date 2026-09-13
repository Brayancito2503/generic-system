import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth, requireTenantId } from '@/lib/session';
import { ApiError, handleApiError } from '@/lib/api-error';
import { idParamSchema, updateCustomerSchema } from '@/core/schemas/distribution';
import { PrismaDistributionRepository } from '@/infrastructure/db/repositories/prisma-distribution.repository';

const repository = new PrismaDistributionRepository();

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireApiAuth(['STAFF', 'TENANT_ADMIN']);
    const tenantId = await requireTenantId();
    if (!tenantId) throw new ApiError(401, 'No autorizado');

    const { id } = await context.params;
    const idParsed = idParamSchema.safeParse(id);
    if (!idParsed.success) throw new ApiError(400, 'Datos inválidos');

    const body = await request.json();
    const parsed = updateCustomerSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, 'Datos inválidos');

    const customer = await repository.updateCustomer(tenantId, id, parsed.data);
    return NextResponse.json(customer);
  } catch (error) {
    return handleApiError(error);
  }
}