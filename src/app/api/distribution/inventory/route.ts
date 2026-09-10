import { NextRequest, NextResponse } from 'next/server';
import { PrismaDistributionRepository } from '@/infrastructure/db/repositories/prisma-distribution.repository';

const repository = new PrismaDistributionRepository();

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get('tenantId');
  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId es requerido' }, { status: 400 });
  }

  try {
    const items = await repository.getInventory(tenantId);
    return NextResponse.json(items);
  } catch (error) {
    console.error('[inventory]', error);
    return NextResponse.json({ error: 'Error al obtener el inventario' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get('tenantId');
  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId es requerido' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { sku, name, description, cost, price, stock, minAlert } = body;

    if (!name || typeof cost !== 'number' || typeof price !== 'number') {
      return NextResponse.json(
        { error: 'name, cost y price son obligatorios' },
        { status: 400 }
      );
    }

    const created = await repository.createInventoryItem(tenantId, {
      sku: sku ?? undefined,
      name: String(name),
      description: description ?? undefined,
      cost,
      price,
      stock: typeof stock === 'number' ? stock : 0,
      minAlert: typeof minAlert === 'number' ? minAlert : 5,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = message.includes('SKU') ? 409 : 500;
    return NextResponse.json({ error: message || 'Error al crear el producto' }, { status });
  }
}