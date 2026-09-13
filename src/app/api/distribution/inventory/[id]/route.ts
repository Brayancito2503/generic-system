import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth, requireTenantId } from '@/lib/session';
import { ApiError, handleApiError } from '@/lib/api-error';
import { idParamSchema, updateInventoryItemSchema } from '@/core/schemas/distribution';
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
    if (!idParamSchema.safeParse(id).success) throw new ApiError(400, 'Datos inválidos');

    const body: unknown = await request.json();
    const parsed = updateInventoryItemSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, 'Datos inválidos');

    // branchId-scoped writes land in P1 (multi-branch updateInventoryItem fix).
    const updated = await repository.updateInventoryItem(tenantId, id, {
      ...(parsed.data.sku !== undefined ? { sku: parsed.data.sku } : {}),
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.description !== undefined
        ? { description: parsed.data.description }
        : {}),
      ...(parsed.data.cost !== undefined ? { cost: parsed.data.cost } : {}),
      ...(parsed.data.price !== undefined ? { price: parsed.data.price } : {}),
      ...(parsed.data.stock !== undefined ? { stock: parsed.data.stock } : {}),
      ...(parsed.data.minAlert !== undefined ? { minAlert: parsed.data.minAlert } : {}),
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}