import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth, requireTenantId } from '@/lib/session';
import { ApiError, handleApiError } from '@/lib/api-error';
import { idParamSchema, updateBranchSchema } from '@/core/schemas/distribution';
import { PrismaDistributionRepository } from '@/infrastructure/db/repositories/prisma-distribution.repository';

const repository = new PrismaDistributionRepository();

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Branch management is a tenant-level decision: TENANT_ADMIN only, the same
    // guard the create route and the tenant settings route use.
    await requireApiAuth(['TENANT_ADMIN']);
    const tenantId = await requireTenantId();
    if (!tenantId) throw new ApiError(401, 'No autorizado');

    const { id } = await context.params;
    const idParsed = idParamSchema.safeParse(id);
    if (!idParsed.success) throw new ApiError(400, 'Datos inválidos');

    const body: unknown = await request.json();
    const parsed = updateBranchSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, 'Datos inválidos');

    // `parsed.data` is forwarded verbatim: it carries only the keys the client
    // actually named, so an omitted field stays undefined and never clears the
    // column. The repository resolves the id under `tenantId` (404 otherwise).
    const branch = await repository.updateBranch(tenantId, id, parsed.data);
    return NextResponse.json(branch);
  } catch (error) {
    return handleApiError(error);
  }
}
