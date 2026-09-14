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

    // Negative-value guard: cost/price/stock/minAlert are `nonnegative` in the
    // schema, so negative values fail safeParse → 400 before touching the DB.
    // Stock writes are branch-scoped: a stock/minAlert update requires the
    // branchId (mismatched branch → 404/400 repo-side; never cross-branch).
    if (
      (parsed.data.stock !== undefined || parsed.data.minAlert !== undefined) &&
      parsed.data.branchId === undefined
    ) {
      throw new ApiError(400, 'Debe indicar la sucursal para actualizar el stock');
    }

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
      ...(parsed.data.branchId !== undefined ? { branchId: parsed.data.branchId } : {}),
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireApiAuth(['STAFF', 'TENANT_ADMIN']);
    const tenantId = await requireTenantId();
    if (!tenantId) throw new ApiError(401, 'No autorizado');

    const { id } = await context.params;
    if (!idParamSchema.safeParse(id).success) throw new ApiError(400, 'Datos inválidos');

    // Referenced items (sales/POs/returns) → 409 in the repository; unlinked
    // items are hard-deleted, Inventory rows cascade.
    await repository.deleteInventoryItem(tenantId, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}