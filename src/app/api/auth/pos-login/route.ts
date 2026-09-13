import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/infrastructure/db/prisma';
import { verifyPassword } from '@/lib/security';
import { SessionPayload, SESSION_COOKIE, sessionCookieOptions, signSession } from '@/lib/session-token';

/**
 * Tenant-scoped POS PIN login: `{ tenant: slug, pin, employeeId? }`.
 *
 * Unlike POS mode in /api/auth/login (which brute-forces every user with a
 * posPinHash across all tenants), this route scopes the PIN check to the
 * tenant identified by its slug, and only admits STAFF users whose linked
 * Employee is active — a deactivated employee's PIN credential is revoked
 * server-side (nulled) on deactivation anyway, so this is defense in depth.
 */
export async function POST(request: NextRequest) {
  let body: { tenant?: unknown; pin?: unknown; employeeId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de solicitud inválido' }, { status: 400 });
  }

  if (typeof body.tenant !== 'string' || body.tenant.trim() === '') {
    return NextResponse.json({ error: 'Tenant es requerido' }, { status: 400 });
  }
  if (typeof body.pin !== 'string' || body.pin.trim() === '') {
    return NextResponse.json({ error: 'El PIN es requerido' }, { status: 400 });
  }

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: body.tenant.trim().toLowerCase() },
    });
    if (!tenant) {
      return NextResponse.json({ error: 'PIN incorrecto' }, { status: 401 });
    }

    // Candidate STAFF users of the tenant with a PIN stored; bcrypt requires
    // iterating candidates (never blind-compare against a bulk list).
    const users = await prisma.user.findMany({
      where: {
        tenantId: tenant.id,
        role: 'STAFF',
        posPinHash: { not: null },
      },
      include: { person: { include: { employee: true } } },
    });

    let matched: UserSessionShape | null = null;
    for (const u of users) {
      if (!u.posPinHash) continue;
      // Employee link must exist and be active; employeeId (when sent) must
      // match, so delegated POS sessions can't be impersonated with a same-tenant PIN.
      const employee = u.person?.employee ?? null;
      if (!employee || employee.isActive === false) continue;
      if (body.employeeId !== undefined && body.employeeId !== employee.id) continue;
      if (await verifyPassword(body.pin, u.posPinHash)) {
        matched = u;
        break;
      }
    }

    if (!matched) {
      return NextResponse.json({ error: 'PIN incorrecto' }, { status: 401 });
    }

    const session = toSession(matched);
    const token = await signSession(session);
    const response = NextResponse.json({ ok: true, user: publicUser(session) });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
    return response;
  } catch (error) {
    console.error('[auth/pos-login]', error);
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