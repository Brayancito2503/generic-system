import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth, requireTenantId } from '@/lib/session';
import { ApiError, handleApiError } from '@/lib/api-error';
import { idParamSchema, updateEmployeeSchema } from '@/core/schemas/distribution';
import { PrismaDistributionRepository } from '@/infrastructure/db/repositories/prisma-distribution.repository';

const repository = new PrismaDistributionRepository();

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireApiAuth(['TENANT_ADMIN']);
    const tenantId = await requireTenantId();
    if (!tenantId) throw new ApiError(401, 'No autorizado');

    const { id } = await context.params;
    const idParsed = idParamSchema.safeParse(id);
    if (!idParsed.success) throw new ApiError(400, 'Datos inválidos');

    const body = await request.json();
    const parsed = updateEmployeeSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, 'Datos inválidos');

    // Contradictory intent: assigning a PIN and deactivating in the same
    // request is rejected before touching the DB (the repo hard-revokes the
    // PIN on deactivation, so the pin would be lost anyway).
    if (parsed.data.isActive === false && parsed.data.pin !== undefined) {
      throw new ApiError(400, 'No se puede asignar un PIN a un empleado inactivo');
    }

    // Any PATCH that includes a PIN goes through the link path (User upsert);
    // field-only changes use the plain update path (deactivate revokes the PIN
    // credential inside the same transaction).
    const employee =
      parsed.data.pin !== undefined
        ? await repository.linkEmployeeUser(tenantId, id, parsed.data)
        : await repository.updateEmployee(tenantId, id, parsed.data);

    return NextResponse.json(employee);
  } catch (error) {
    return handleApiError(error);
  }
}