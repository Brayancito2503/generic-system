import { NextRequest, NextResponse } from 'next/server';
import { PrismaDistributionRepository } from '@/infrastructure/db/repositories/prisma-distribution.repository';

const repository = new PrismaDistributionRepository();

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get('tenantId');
  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId es requerido' }, { status: 400 });
  }

  try {
    const session = await repository.getOpenCashSession(tenantId);
    return NextResponse.json(session);
  } catch (error) {
    console.error('[cash]', error);
    return NextResponse.json({ error: 'Error al obtener la sesión de caja' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get('tenantId');
  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId es requerido' }, { status: 400 });
  }

  try {
    const body = await request.json();
    if (typeof body.openingAmount !== 'number') {
      return NextResponse.json(
        { error: 'openingAmount es obligatorio' },
        { status: 400 }
      );
    }

    const session = await repository.openCashSession(tenantId, {
      branchId: body.branchId ?? undefined,
      openingAmount: body.openingAmount,
      employeeId: body.employeeId ?? null,
    });

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error('[cash]', error);
    return NextResponse.json({ error: 'Error al abrir la caja' }, { status: 500 });
  }
}