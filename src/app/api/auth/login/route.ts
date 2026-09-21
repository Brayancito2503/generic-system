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
      // Soft-deleted tenants (Tenant.active = false) must not authenticate:
      // the SUPER_ADMIN toggle blocks access at the login boundary.
      if (!(await isTenantActive(user.tenantId))) {
        return NextResponse.json(
          { error: 'Tenant desactivado. Contacte al administrador del sistema.' },
          { status: 403 }
        );
      }
      session = toSession(user);
    } else {
      if (typeof body.pin !== 'string') {
        return NextResponse.json({ error: 'El PIN es requerido' }, { status: 400 });
      }
      // POS mode mirrors the tenant-scoped pos-login semantics: only legacy
      // STAFF and the POS-capable access profiles may authenticate by PIN
      // (TENANT_ADMIN/SUPER_ADMIN never via a shared PIN — a MANAGER employee
      // linked by linkEmployeeUser must use real credentials), the linked
      // Employee must exist and be active, and deactivated tenants are skipped
      // so their PINs cannot be probed.
      const users = await prisma.user.findMany({
        where: {
          posPinHash: { not: null },
          role: { in: ['STAFF', 'CASHIER', 'ACCOUNTANT'] },
        },
        include: {
          person: { include: { employee: true } },
          tenant: { select: { active: true } },
        },
      });
      let matched: UserSessionShape | null = null;
      for (const u of users) {
        // Skip PIN comparison for users of deactivated tenants: their PIN
        // must not be probeable and they must never match (no acceso).
        if (u.tenant?.active === false) continue;
        // An employee link must exist and be active; a deactivated employee's
        // PIN credential is revoked server-side (nulled) anyway, so this is
        // defense in depth against stale/mislinked PIN rows.
        const employee = u.person?.employee ?? null;
        if (!employee || employee.isActive === false) continue;
        if (u.posPinHash && (await verifyPassword(body.pin, u.posPinHash))) {
          matched = u;
          break;
        }
      }
      // Generic 401: do not reveal whether the PIN exists on an inactive tenant.
      if (!matched) {
        return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
      }
      if (!(await isTenantActive(matched.tenantId))) {
        return NextResponse.json(
          { error: 'Tenant desactivado. Contacte al administrador del sistema.' },
          { status: 403 }
        );
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

/**
 * Login gate for the SUPER_ADMIN toggle contract: `Tenant.active = false`
 * (soft-delete) blocks authentication. Defensive fallback: a user without a
 * resolvable tenant row is also treated as blocked.
 */
async function isTenantActive(tenantId: string): Promise<boolean> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { active: true },
  });
  return tenant?.active ?? false;
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