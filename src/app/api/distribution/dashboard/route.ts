import { NextRequest, NextResponse } from 'next/server';
import { PrismaDistributionRepository } from '@/infrastructure/db/repositories/prisma-distribution.repository';

const repository = new PrismaDistributionRepository();

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get('tenantId');
  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId es requerido' }, { status: 400 });
  }

  try {
    const stats = await repository.getDashboard(tenantId);
    return NextResponse.json(stats);
  } catch (error) {
    console.error('[dashboard]', error);
    return NextResponse.json({ error: 'Error al obtener el dashboard' }, { status: 500 });
  }
}