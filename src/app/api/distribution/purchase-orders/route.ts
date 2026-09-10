import { NextRequest, NextResponse } from 'next/server';
import { PrismaDistributionRepository } from '@/infrastructure/db/repositories/prisma-distribution.repository';

const repository = new PrismaDistributionRepository();

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get('tenantId');
  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId es requerido' }, { status: 400 });
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