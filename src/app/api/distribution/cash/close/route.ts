import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth, requireTenantId } from '@/lib/session';
import { ApiError, handleApiError } from '@/lib/api-error';
import { closeCashSessionSchema } from '@/core/schemas/distribution';
import { PrismaDistributionRepository } from '@/infrastructure/db/repositories/prisma-distribution.repository';

const repository = new PrismaDistributionRepository();

export async function POST(request: NextRequest) {
  try {
    await requireApiAuth(['ACCOUNTANT', 'STAFF', 'TENANT_ADMIN']);
    const tenantId = await requireTenantId();
    if (!tenantId) throw new ApiError(401, 'No autorizado');

    const body: unknown = await request.json();
    const direct = closeCashSessionSchema.safeParse(body);

    let closeInput: { sessionId: string; physicalCount: number };
    if (direct.success) {
      closeInput = direct.data;
    } else {
      // Legacy bridge: current UI still posts closingAmount/expectedAmount/difference.
      // Only sessionId + the physical count are honored; fabricated values are dropped.
      const record = (body ?? {}) as Record<string, unknown>;
      const legacy = closeCashSessionSchema.safeParse({
        sessionId: record.sessionId,
        physicalCount: record.closingAmount,
      });
      if (!legacy.success) throw new ApiError(400, 'Datos inválidos');
      closeInput = legacy.data;
    }

    // Server-side expected/difference derivation replaces this in P0; the client
    // never controls them here (only the physical count is trusted).
    const session = await repository.closeCashSession(tenantId, {
      sessionId: closeInput.sessionId,
      physicalCount: closeInput.physicalCount,
    });

    return NextResponse.json(session);
  } catch (error) {
    return handleApiError(error);
  }
}