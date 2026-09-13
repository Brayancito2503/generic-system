import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { handleApiError } from '@/lib/api-error';
import { prisma } from '@/infrastructure/db/prisma';

export async function GET(request: NextRequest) {
  try {
    void request;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Tenant shell is derived from the session server-side; the client NEVER sends tenantId.
    const tenant = await prisma.tenant.findUnique({
      where: { id: session.tenantId },
      select: { name: true, modules: true },
    });

    return NextResponse.json({
      user: {
        userId: session.userId,
        tenantId: session.tenantId,
        role: session.role,
        name: session.name,
        email: session.email,
      },
      tenant: {
        name: tenant?.name ?? '',
        modules: tenant?.modules ?? [],
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}