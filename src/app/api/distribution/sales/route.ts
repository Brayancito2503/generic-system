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
    const limitParam = Number(request.nextUrl.searchParams.get('limit'));
    const limit = Number.isFinite(limitParam) ? limitParam : 100;
    const sales = await repository.getSales(tenantId, limit);
    return NextResponse.json(sales);
  } catch (error) {
    console.error('[sales]', error);
    return NextResponse.json(
      { error: 'Error al obtener el historial de ventas' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const tenantId = await requireTenantId();
  if (!tenantId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (!Array.isArray(body.lines) || body.lines.length === 0) {
      return NextResponse.json(
        { error: 'Debe incluir al menos un producto en la venta' },
        { status: 400 }
      );
    }

    const lines = body.lines.map((l: unknown) => {
      const line = l as { itemId?: unknown; quantity?: unknown };
      if (
        typeof line.itemId !== 'string' ||
        typeof line.quantity !== 'number' ||
        !Number.isInteger(line.quantity) ||
        line.quantity <= 0
      ) {
        throw new Error('Línea de venta inválida');
      }
      return { itemId: line.itemId, quantity: line.quantity };
    });

    const sale = await repository.registerSale(tenantId, {
      lines,
      discount: typeof body.discount === 'number' ? body.discount : 0,
      personId: typeof body.personId === 'string' ? body.personId : null,
      notes: typeof body.notes === 'string' ? body.notes : null,
    });

    return NextResponse.json(sale, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = message.includes('Stock insuficiente') ? 409 : 400;
    return NextResponse.json(
      { error: message || 'Error al registrar la venta' },
      { status }
    );
  }
}