import { NextRequest, NextResponse } from 'next/server';
import { requireTenantId } from '@/lib/session';
import { PrismaDistributionRepository } from '@/infrastructure/db/repositories/prisma-distribution.repository';

const repository = new PrismaDistributionRepository();

export async function GET(request: NextRequest) {
  const tenantId = await requireTenantId();
  if (!tenantId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const q = request.nextUrl.searchParams.get('q') ?? undefined;
    const customers = await repository.findCustomers(tenantId, q);
    return NextResponse.json(customers);
  } catch (error) {
    console.error('[customers]', error);
    return NextResponse.json({ error: 'Error al obtener los clientes' }, { status: 500 });
  }
}