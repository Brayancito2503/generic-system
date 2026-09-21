import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth, requireTenantId } from '@/lib/session';
import { ApiError, handleApiError } from '@/lib/api-error';
import { idParamSchema, payReceivableSchema } from '@/core/schemas/distribution';
import { PrismaDistributionRepository } from '@/infrastructure/db/repositories/prisma-distribution.repository';

const repository = new PrismaDistributionRepository();

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireApiAuth(['CASHIER', 'ACCOUNTANT', 'STAFF', 'TENANT_ADMIN']);
    const tenantId = await requireTenantId();
    if (!tenantId) throw new ApiError(401, 'No autorizado');

    const { id } = await context.params;
    const receivableId = idParamSchema.safeParse(id);
    if (!receivableId.success) throw new ApiError(400, 'Datos inválidos');

    const body: unknown = await request.json();
    const parsed = payReceivableSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, 'Datos inválidos');

    // Overpay (amount > remaining balance) → 409 propagates untouched through
    // handleApiError; the payment record and balance/status update are one tx.
    const result = await repository.payReceivable(tenantId, id, {
      amount: parsed.data.amount,
      method: parsed.data.method,
    });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}