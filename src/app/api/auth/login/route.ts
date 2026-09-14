import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/infrastructure/db/prisma';
import { verifyPassword } from '@/lib/security';
import { SessionPayload, SESSION_COOKIE, sessionCookieOptions, signSession } from '@/lib/session-token';

export async function POST(request: NextRequest) {
  let body: { mode?: unknown; email?: unknown; password?: unknown; pin?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de solicitud inválido' }, { status: 400 });
  }

  if (body.mode !== 'admin' && body.mode !== 'pos') {
    return NextResponse.json({ error: 'Modo de acceso inválido' }, { status: 400 });
  }

  try {
    let session: SessionPayload | null = null;

    if (body.mode === 'admin') {
      if (typeof body.email !== 'string' || typeof body.password !== 'string') {
        return NextResponse.json({ error: 'Email y contraseña son requeridos' }, { status: 400 });
      }
      const email = body.email.trim().toLowerCase();
      const user = await prisma.user.findFirst({
        where: { email },
        include: { person: true },
      });
      if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
        return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
      }
      session = toSession(user);
    } else {
      if (typeof body.pin !== 'string') {
        return NextResponse.json({ error: 'El PIN es requerido' }, { status: 400 });
      }
      const users = await prisma.user.findMany({
        where: { posPinHash: { not: null } },
        include: { person: true },
      });
      let matched: UserSessionShape | null = null;
      for (const u of users) {
        if (u.posPinHash && (await verifyPassword(body.pin, u.posPinHash))) {
          matched = u;
          break;
        }
      }
      if (!matched) {
        return NextResponse.json({ error: 'PIN inválido' }, { status: 401 });
      }
      session = toSession(matched);
    }

    const token = await signSession(session);
    const response = NextResponse.json({ ok: true, user: publicUser(session) });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
    return response;
  } catch (error) {
    console.error('[auth/login]', error);
    return NextResponse.json({ error: 'Error al iniciar sesión' }, { status: 500 });
  }
}

type UserSessionShape = {
  id: string;
  tenantId: string;
  role: string;
  email: string;
  person: { firstName: string; lastName: string } | null;
};

function toSession(user: UserSessionShape): SessionPayload {
  const name = user.person
    ? `${user.person.firstName} ${user.person.lastName}`.trim()
    : user.email;
  return {
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role as SessionPayload['role'],
    name,
    email: user.email,
  };
}

function publicUser(session: SessionPayload) {
  return {
    userId: session.userId,
    tenantId: session.tenantId,
    role: session.role,
    name: session.name,
    email: session.email,
  };
}