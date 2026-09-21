import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth, requireTenantId } from '@/lib/session';
import { ApiError, handleApiError } from '@/lib/api-error';
import { registerSaleSchema, salesListQuerySchema } from '@/core/schemas/distribution';
import { PrismaDistributionRepository } from '@/infrastructure/db/repositories/prisma-distribution.repository';

const repository = new PrismaDistributionRepository();

export async function GET(request: NextRequest) {
  try {
    // Read-only listing: ReceivablesView (CASHIER/ACCOUNTANT) resolves fiado
    // invoice labels from GET /sales; the payload is tenant-scoped invoice
    // data already visible to both profiles (customer name + amounts). POST is
    // unchanged below — reading the list never grants sale creation.
    await requireApiAuth(['CASHIER', 'ACCOUNTANT', 'STAFF', 'TENANT_ADMIN']);
    const tenantId = await requireTenantId();
    if (!tenantId) throw new ApiError(401, 'No autorizado');

    const query = salesListQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams.entries())
    );
    if (!query.success) throw new ApiError(400, 'Datos inválidos');

    const result = await repository.getSales(tenantId, query.data.page, query.data.limit);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireApiAuth(['CASHIER', 'STAFF', 'TENANT_ADMIN']);
    const tenantId = await requireTenantId();
    if (!tenantId) throw new ApiError(401, 'No autorizado');

    const body: unknown = await request.json();
    const parsed = registerSaleSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, 'Datos inválidos');

    // Server-side money math (total − paidAmount = balance) and receivable
    // creation happen inside the registerSale transaction.
    const sale = await repository.registerSale(tenantId, {
      lines: parsed.data.lines,
      discount: parsed.data.discount,
      personId: parsed.data.personId ?? null,
      notes: parsed.data.notes ?? null,
      paymentMethod: parsed.data.paymentMethod,
      paidAmount: parsed.data.paidAmount,
    });

    return NextResponse.json(sale, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}