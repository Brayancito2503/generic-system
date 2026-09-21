import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth, requireTenantId } from '@/lib/session';
import { ApiError, handleApiError } from '@/lib/api-error';
import { customerSearchQuerySchema } from '@/core/schemas/tenant';
import { createCustomerSchema } from '@/core/schemas/distribution';
import { PrismaDistributionRepository } from '@/infrastructure/db/repositories/prisma-distribution.repository';

const repository = new PrismaDistributionRepository();

export async function GET(request: NextRequest) {
  try {
    await requireApiAuth(['CASHIER', 'STAFF', 'TENANT_ADMIN']);
    const tenantId = await requireTenantId();
    if (!tenantId) throw new ApiError(401, 'No autorizado');

    const query = customerSearchQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams.entries())
    );
    if (!query.success) throw new ApiError(400, 'Datos inválidos');

    const customers = await repository.findCustomers(tenantId, query.data.q ?? undefined);
    return NextResponse.json(customers);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireApiAuth(['CASHIER', 'STAFF', 'TENANT_ADMIN']);
    const tenantId = await requireTenantId();
    if (!tenantId) throw new ApiError(401, 'No autorizado');

    const body = await request.json();
    const parsed = createCustomerSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, 'Datos inválidos');

    const customer = await repository.createCustomer(tenantId, parsed.data);
    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}