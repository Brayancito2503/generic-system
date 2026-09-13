import 'server-only';

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  SESSION_COOKIE,
  SessionPayload,
  SessionRole,
  sessionCookieOptions,
  verifySessionToken,
} from './session-token';

export class UnauthorizedError extends Error {
  constructor(message = 'No autorizado') {
    super(message);
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Permisos insuficientes') {
    super(message);
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export function destroySessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(SESSION_COOKIE, '', {
    ...sessionCookieOptions,
    maxAge: 0,
  });
  return response;
}

export async function requireApiAuth(roles?: SessionRole[]): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new UnauthorizedError();
  }
  if (roles && !roles.includes(session.role)) {
    throw new ForbiddenError();
  }
  return session;
}

export async function requireTenantId(): Promise<string | null> {
  const session = await getSession();
  return session?.tenantId ?? null;
}