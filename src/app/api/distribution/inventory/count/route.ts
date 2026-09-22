import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth, requireTenantId } from '@/lib/session';
import { ApiError, handleApiError } from '@/lib/api-error';
import { createCountBatchSchema } from '@/core/schemas/distribution';
import { PrismaDistributionRepository } from '@/infrastructure/db/repositories/prisma-distribution.repository';

const repository = new PrismaDistributionRepository();

/**
 * Physical-count batch: posts one SOBRANTE/MERMA adjustment per item whose
 * counted quantity differs from the book stock (zeros are skipped), all in a
 * single transaction. POST is restricted to ACCOUNTANT/TENANT_ADMIN — a count
 * writes the day's merma into the P&L.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireApiAuth(['ACCOUNTANT', 'TENANT_ADMIN']);
    const tenantId = await requireTenantId();
    if (!tenantId) throw new ApiError(401, 'No autorizado');

    const body: unknown = await request.json();
    const parsed = createCountBatchSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, 'Datos inválidos');

    const created = await repository.createInventoryCountBatch(tenantId, {
      branchId: parsed.data.branchId,
      items: parsed.data.items,
      // Operator of every ADJUSTMENT ledger row this batch writes.
      userId: session.userId,
    });

    // 200 + warning when the whole batch matched the book (nothing changed),
    // 201 with the created adjustments otherwise.
    return NextResponse.json(
      { created, warning: created.length === 0 },
      { status: created.length === 0 ? 200 : 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}