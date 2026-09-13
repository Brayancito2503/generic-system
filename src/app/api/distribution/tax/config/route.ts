import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth, requireTenantId } from '@/lib/session';
import { ApiError, handleApiError } from '@/lib/api-error';
import { invoicingConfigSchema } from '@/core/schemas/distribution';
import { noQueryParamsSchema } from '@/core/schemas/tenant';
import { PrismaDistributionRepository } from '@/infrastructure/db/repositories/prisma-distribution.repository';

const repository = new PrismaDistributionRepository();

export async function GET(request: NextRequest) {
  try {
    await requireApiAuth(['TENANT_ADMIN']);
    const tenantId = await requireTenantId();
    if (!tenantId) throw new ApiError(401, 'No autorizado');

    const query = noQueryParamsSchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams.entries())
    );
    if (!query.success) throw new ApiError(400, 'Datos inválidos');

    const config = await repository.getInvoicingConfig(tenantId);
    // 404 (not null): the step warns the tenant to configure CAI before first
    // invoice; the UI surfaces the setup form with the endpoint URL.
    if (!config) throw new ApiError(404, 'Configuración fiscal no definida');
    return NextResponse.json(config);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireApiAuth(['TENANT_ADMIN']);
    const tenantId = await requireTenantId();
    if (!tenantId) throw new ApiError(401, 'No autorizado');

    const body = await request.json();
    const parsed = invoicingConfigSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, 'Datos inválidos');

    const config = await repository.updateInvoicingConfig(tenantId, parsed.data);
    return NextResponse.json(config);
  } catch (error) {
    return handleApiError(error);
  }
}