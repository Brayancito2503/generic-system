import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth, requireTenantId } from '@/lib/session';
import { ApiError, handleApiError } from '@/lib/api-error';
import {
  noQueryParamsSchema,
  tenantSettingsSchema,
  tenantSettingsUpdateSchema,
} from '@/core/schemas/tenant';
import { prisma } from '@/infrastructure/db/prisma';

/**
 * Plain optional-field shape of Tenant.settings for writes. The zod schema is
 * `.passthrough()` (its inferred type carries an `[x: string]: unknown` index
 * that Prisma's Json input union rejects), so the merged object is mapped to
 * this shape at the write boundary — never `any`. Declared as a type alias
 * (not an interface) so TS infers the implicit index signature Prisma requires.
 */
type TenantSettingsPayload = {
  logoUrl?: string;
  primaryColor?: string;
  currency?: string;
  currencySymbol?: string;
  secondaryCurrency?: string;
  exchangeRate?: number;
  timezone?: string;
};

/**
 * Tenant settings read (STAFF, ACCOUNTANT, TENANT_ADMIN) & admin write (TENANT_ADMIN):
 * reads and updates the tenant identity (Tenant.name) plus the validated `Tenant.settings` JSONB.
 * The tenantId is always derived from the session — never from the client.
 */
export async function GET(request: NextRequest) {
  try {
    await requireApiAuth(['ACCOUNTANT', 'STAFF', 'TENANT_ADMIN']);
    const tenantId = await requireTenantId();
    if (!tenantId) throw new ApiError(401, 'No autorizado');

    const query = noQueryParamsSchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams.entries())
    );
    if (!query.success) throw new ApiError(400, 'Datos inválidos');

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, industry: true, settings: true },
    });
    if (!tenant) throw new ApiError(404, 'Tenant no encontrado');

    const parsedSettings = tenantSettingsSchema.safeParse(tenant.settings);
    return NextResponse.json({
      name: tenant.name,
      industry: tenant.industry,
      settings: parsedSettings.success ? parsedSettings.data : {},
    });
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
    const parsed = tenantSettingsUpdateSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, 'Datos inválidos');

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, settings: true },
    });
    if (!tenant) throw new ApiError(404, 'Tenant no encontrado');

    // Merge over the persisted settings so passthrough keys are never dropped.
    const currentSettings = tenantSettingsSchema.safeParse(tenant.settings).success
      ? tenantSettingsSchema.parse(tenant.settings)
      : {};
    const mergedSettings = {
      ...currentSettings,
      ...(parsed.data.settings ?? {}),
    } as TenantSettingsPayload;

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(Object.keys(mergedSettings).length > 0 ? { settings: mergedSettings } : {}),
      },
      select: { name: true, industry: true, settings: true },
    });

    const parsedUpdated = tenantSettingsSchema.safeParse(updated.settings);
    return NextResponse.json({
      name: updated.name,
      industry: updated.industry,
      settings: parsedUpdated.success ? parsedUpdated.data : {},
    });
  } catch (error) {
    return handleApiError(error);
  }
}