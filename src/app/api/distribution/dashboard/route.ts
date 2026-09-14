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
    const stats = await repository.getDashboard(tenantId);
    return NextResponse.json(stats);
  } catch (error) {
    console.error('[dashboard]', error);
    return NextResponse.json({ error: 'Error al obtener el dashboard' }, { status: 500 });
  }
}