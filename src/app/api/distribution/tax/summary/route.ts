import { NextResponse } from 'next/server';
import { requireTenantId } from '@/lib/session';
import { PrismaDistributionRepository } from '@/infrastructure/db/repositories/prisma-distribution.repository';

const repository = new PrismaDistributionRepository();

export async function GET() {
  const tenantId = await requireTenantId();
  if (!tenantId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const summary = await repository.getFiscalSummary(tenantId);
    return NextResponse.json(summary);
  } catch (error) {
    console.error('[tax/summary]', error);
    return NextResponse.json(
      { error: 'Error al obtener el resumen fiscal' },
      { status: 500 }
    );
  }
}