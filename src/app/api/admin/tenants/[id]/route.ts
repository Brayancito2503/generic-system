import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/infrastructure/db/prisma';
import { requireApiAuth } from '@/lib/session';
import { ApiError, handleApiError } from '@/lib/api-error';
import {
  tenantIdParamSchema,
  updateTenantAdminSchema,
} from '@/core/schemas/admin-tenants';

/**
 * PATCH /api/admin/tenants/[id] (SUPER_ADMIN): edit tenant identity (name,
 * industry, modules) or toggle `active` (soft-delete). There is intentionally
 * NO hard DELETE: `active: false` is the deactivation contract.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireApiAuth(['SUPER_ADMIN']);

    const { id } = await context.params;
    const idParsed = tenantIdParamSchema.safeParse(id);
    if (!idParsed.success) throw new ApiError(400, 'Datos inválidos');

    const body: unknown = await request.json();
    const parsed = updateTenantAdminSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, 'Datos inválidos');

    const existing = await prisma.tenant.findUnique({ where: { id: idParsed.data } });
    if (!existing) throw new ApiError(404, 'Tenant no encontrado');

    const updated = await prisma.tenant.update({
      where: { id: idParsed.data },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.industry !== undefined ? { industry: parsed.data.industry } : {}),
        ...(parsed.data.modules !== undefined ? { modules: parsed.data.modules } : {}),
        ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}