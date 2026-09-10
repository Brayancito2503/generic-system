import { NextRequest, NextResponse } from 'next/server';
import { requireTenantId } from '@/lib/session';
import { PrismaDistributionRepository } from '@/infrastructure/db/repositories/prisma-distribution.repository';

const repository = new PrismaDistributionRepository();

export async function POST(request: NextRequest) {
  const tenantId = await requireTenantId();
  if (!tenantId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await request.json();
    if (!body.sessionId || !body.concept || typeof body.amount !== 'number') {
      return NextResponse.json(
        { error: 'sessionId, concept y amount son obligatorios' },
        { status: 400 }
      );
    }
    if (body.type !== 'IN' && body.type !== 'OUT') {
      return NextResponse.json(
        { error: 'type debe ser IN o OUT' },
        { status: 400 }
      );
    }

    const movement = await repository.addCashMovement(tenantId, {
      sessionId: String(body.sessionId),
      type: body.type,
      amount: body.amount,
      concept: String(body.concept),
    });

    return NextResponse.json(movement, { status: 201 });
  } catch (error) {
    console.error('[cash/movements]', error);
    const message =
      error instanceof Error && error.message.includes('Sesión de caja')
        ? error.message
        : 'Error al registrar el movimiento';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}