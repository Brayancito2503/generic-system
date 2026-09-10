import { NextRequest, NextResponse } from 'next/server';
import { PrismaDistributionRepository } from '@/infrastructure/db/repositories/prisma-distribution.repository';

const repository = new PrismaDistributionRepository();

export async function POST(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get('tenantId');
  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId es requerido' }, { status: 400 });
  }

  try {
    const body = await request.json();
    if (!body.sessionId || typeof body.closingAmount !== 'number') {
      return NextResponse.json(
        { error: 'sessionId y closingAmount son obligatorios' },
        { status: 400 }
      );
    }

    const session = await repository.closeCashSession(tenantId, {
      sessionId: String(body.sessionId),
      closingAmount: body.closingAmount,
      expectedAmount:
        typeof body.expectedAmount === 'number' ? body.expectedAmount : body.closingAmount,
      difference: typeof body.difference === 'number' ? body.difference : 0,
    });

    return NextResponse.json(session);
  } catch (error) {
    console.error('[cash/close]', error);
    const message =
      error instanceof Error && error.message.includes('Sesión de caja')
        ? error.message
        : 'Error al cerrar la caja';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}