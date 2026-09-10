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
    const orders = await repository.getPurchaseOrders(tenantId);
    return NextResponse.json(orders);
  } catch (error) {
    console.error('[purchase-orders]', error);
    return NextResponse.json(
      { error: 'Error al obtener las órdenes de compra' },
      { status: 500 }
    );
  }
}