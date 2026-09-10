import { NextRequest, NextResponse } from 'next/server';
import { PrismaDistributionRepository } from '@/infrastructure/db/repositories/prisma-distribution.repository';

const repository = new PrismaDistributionRepository();

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const tenantId = request.nextUrl.searchParams.get('tenantId');
  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId es requerido' }, { status: 400 });
  }

  try {
    const { id } = await context.params;
    const body = await request.json();
    if (
      body.name === undefined &&
      typeof body.rate !== 'number' &&
      body.isInclusive === undefined &&
      body.isActive === undefined &&
      body.isDefault === undefined
    ) {
      return NextResponse.json(
        { error: 'No hay campos válidos para actualizar' },
        { status: 400 }
      );
    }

    const updated = await repository.updateTaxRate(tenantId, id, {
      ...(body.name !== undefined ? { name: String(body.name) } : {}),
      ...(typeof body.rate === 'number' ? { rate: body.rate } : {}),
      ...(body.isInclusive !== undefined ? { isInclusive: body.isInclusive === true } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive === true } : {}),
      ...(body.isDefault !== undefined ? { isDefault: body.isDefault === true } : {}),
    });

    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tasa no encontrada';
    const notFound = message === 'Tasa de impuesto no encontrada';
    console.error('[tax/:id]', error);
    return NextResponse.json(
      { error: message },
      { status: notFound ? 404 : 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const tenantId = request.nextUrl.searchParams.get('tenantId');
  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId es requerido' }, { status: 400 });
  }

  try {
    const { id } = await context.params;
    await repository.deleteTaxRate(tenantId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tasa no encontrada';
    const isExpected = message.includes('no encontrada') || message.includes('al menos una');
    console.error('[tax/:id]', error);
    return NextResponse.json({ error: message }, { status: isExpected ? 400 : 500 });
  }
}