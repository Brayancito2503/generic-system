import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  return NextResponse.json({
    user: {
      userId: session.userId,
      tenantId: session.tenantId,
      role: session.role,
      name: session.name,
      email: session.email,
    },
  });
}