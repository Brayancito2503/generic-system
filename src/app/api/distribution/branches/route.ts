import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth, requireTenantId } from '@/lib/session';
import { ApiError, handleApiError } from '@/lib/api-error';
import { noQueryParamsSchema } from '@/core/schemas/tenant';
import { createBranchSchema } from '@/core/schemas/distribution';
import { PrismaDistributionRepository } from '@/infrastructure/db/repositories/prisma-distribution.repository';

const repository = new PrismaDistributionRepository();

export async function GET(request: NextRequest) {
  try {
    // Read: every distribution profile resolves the branch a sale or a stock
    // row belongs to, so the list is visible to all of them.
    await requireApiAuth(['ACCOUNTANT', 'STAFF', 'TENANT_ADMIN']);
    const tenantId = await requireTenantId();
    if (!tenantId) throw new ApiError(401, 'No autorizado');

    const query = noQueryParamsSchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams.entries())
    );
    if (!query.success) throw new ApiError(400, 'Datos inválidos');

    // Tenant comes from the session, never from a query param: a `?tenantId=`
    // is rejected by `noQueryParamsSchema` above.
    const branches = await repository.listBranches(tenantId);
    return NextResponse.json(branches);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Write: branch management is a tenant-level decision, so it stays
    // TENANT_ADMIN-only — the same guard the tenant settings route uses.
    await requireApiAuth(['TENANT_ADMIN']);
    const tenantId = await requireTenantId();
    if (!tenantId) throw new ApiError(401, 'No autorizado');

    const body: unknown = await request.json();
    const parsed = createBranchSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, 'Datos inválidos');

    // `tenantId` is absent from `createBranchSchema`, so a client-supplied one
    // is stripped by the non-strict object and never reaches the repository.
    const created = await repository.createBranch(tenantId, {
      name: parsed.data.name,
      address: parsed.data.address ?? null,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
