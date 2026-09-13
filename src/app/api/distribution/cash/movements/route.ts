import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth, requireTenantId } from '@/lib/session';
import { ApiError, handleApiError } from '@/lib/api-error';
import { addCashMovementSchema } from '@/core/schemas/distribution';
import { PrismaDistributionRepository } from '@/infrastructure/db/repositories/prisma-distribution.repository';

const repository = new PrismaDistributionRepository();

export async function POST(request: NextRequest) {
  try {
    await requireApiAuth(['STAFF', 'TENANT_ADMIN']);
    const tenantId = await requireTenantId();
    if (!tenantId) throw new ApiError(401, 'No autorizado');

    const body: unknown = await request.json();
    const parsed = addCashMovementSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, 'Datos inválidos');

    const movement = await repository.addCashMovement(tenantId, {
      sessionId: parsed.data.sessionId,
      type: parsed.data.type,
      amount: parsed.data.amount,
      concept: parsed.data.concept,
    });

    return NextResponse.json(movement, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}