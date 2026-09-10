import { NextRequest, NextResponse } from 'next/server';
import { requireTenantId } from '@/lib/session';
import { PrismaDistributionRepository } from '@/infrastructure/db/repositories/prisma-distribution.repository';

const repository = new PrismaDistributionRepository();

export async function GET() {
  const tenantId = await requireTenantId();
  if (!tenantId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const rates = await repository.getTaxRates(tenantId);
    return NextResponse.json(rates);
  } catch (error) {
    console.error('[tax]', error);
    return NextResponse.json({ error: 'Error al obtener las tasas de impuesto' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const tenantId = await requireTenantId();
  if (!tenantId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await request.json();
    if (!body.name || typeof body.rate !== 'number') {
      return NextResponse.json(
        { error: 'name y rate son obligatorios' },
        { status: 400 }
      );
    }

    const created = await repository.createTaxRate(tenantId, {
      name: String(body.name),
      rate: body.rate,
      isInclusive: body.isInclusive !== false,
      isDefault: body.isDefault === true,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('[tax]', error);
    return NextResponse.json(
      { error: 'Error al crear la tasa de impuesto' },
      { status: 500 }
    );
  }
}