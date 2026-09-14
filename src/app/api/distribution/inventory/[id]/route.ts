import { NextRequest, NextResponse } from 'next/server';
import { requireTenantId } from '@/lib/session';
import { PrismaDistributionRepository } from '@/infrastructure/db/repositories/prisma-distribution.repository';

const repository = new PrismaDistributionRepository();

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const tenantId = await requireTenantId();
  const { id } = await context.params;

  if (!tenantId || !id) {
    return NextResponse.json(
      { error: 'No autorizado' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const input: {
      sku?: string;
      name?: string;
      description?: string;
      cost?: number;
      price?: number;
      stock?: number;
      minAlert?: number;
    } = {};

    if (body.sku !== undefined) input.sku = String(body.sku);
    if (body.name !== undefined) input.name = String(body.name);
    if (body.description !== undefined) input.description = String(body.description);
    if (typeof body.cost === 'number') input.cost = body.cost;
    if (typeof body.price === 'number') input.price = body.price;
    if (typeof body.stock === 'number') input.stock = body.stock;
    if (typeof body.minAlert === 'number') input.minAlert = body.minAlert;

    const updated = await repository.updateInventoryItem(tenantId, id, input);
    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = message.includes('SKU') ? 409 : message.includes('no encontrado') ? 400 : 500;
    return NextResponse.json({ error: message || 'Error al actualizar el producto' }, { status });
  }
}