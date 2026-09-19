import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SignJWT } from 'jose';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  ForbiddenError,
  UnauthorizedError,
  destroySessionCookie,
  getSession,
  requireApiAuth,
  requireTenantId,
} from './session';
import { SESSION_COOKIE, signSession, type SessionPayload } from './session-token';

type CookieStore = Awaited<ReturnType<typeof cookies>>;

const SESSION: SessionPayload = {
  userId: 'usr_1',
  tenantId: 'tnt_1',
  role: 'TENANT_ADMIN',
  name: 'Ana Lopez',
  email: 'ana@example.com',
};

function setCookie(token: string | null): void {
  const store = {
    get: vi.fn((name: string) =>
      name === SESSION_COOKIE && token ? { value: token } : undefined
    ),
  } as unknown as CookieStore;
  vi.mocked(cookies).mockResolvedValue(store);
}

async function signValidToken(payload: SessionPayload = SESSION): Promise<string> {
  return signSession(payload);
}

beforeEach(() => {
  vi.mocked(cookies).mockReset();
});

afterEach(() => {
  vi.mocked(cookies).mockReset();
});

describe('getSession', () => {
  it('returns null when no session cookie is present', async () => {
    setCookie(null);
    await expect(getSession()).resolves.toBeNull();
  });

  it('returns the session payload when a valid token is present', async () => {
    const token = await signValidToken();
    setCookie(token);
    await expect(getSession()).resolves.toEqual(SESSION);
  });

  it('returns null when the stored token is invalid', async () => {
    setCookie('invalid.token.value');
    await expect(getSession()).resolves.toBeNull();
  });
});

describe('requireApiAuth', () => {
  it('throws UnauthorizedError when there is no session', async () => {
    setCookie(null);
    await expect(requireApiAuth()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('throws UnauthorizedError when the token is invalid', async () => {
    setCookie('not.a.jwt');
    await expect(requireApiAuth()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('returns the session for an allowed role', async () => {
    setCookie(await signValidToken({ ...SESSION, role: 'STAFF' }));
    await expect(requireApiAuth(['STAFF'])).resolves.toEqual({
      ...SESSION,
      role: 'STAFF',
    });
  });

  it('throws ForbiddenError when the role is not allowed', async () => {
    setCookie(await signValidToken({ ...SESSION, role: 'CUSTOMER' }));
    await expect(requireApiAuth(['STAFF', 'TENANT_ADMIN'])).rejects.toBeInstanceOf(
      ForbiddenError
    );
  });

  it('lets SUPER_ADMIN pass any role restriction (global bypass)', async () => {
    setCookie(await signValidToken({ ...SESSION, role: 'SUPER_ADMIN' }));
    await expect(requireApiAuth(['CUSTOMER'])).resolves.toEqual({
      ...SESSION,
      role: 'SUPER_ADMIN',
    });
  });

  it('accepts any session when no roles are required', async () => {
    setCookie(await signValidToken({ ...SESSION, role: 'CUSTOMER' }));
    await expect(requireApiAuth()).resolves.toEqual({ ...SESSION, role: 'CUSTOMER' });
  });

  it('rejects a token with a forged role even when no roles are required', async () => {
    const forged = await new SignJWT({ userId: 'usr_1', tenantId: 'tnt_9', role: 'GOD' })
      .setProtectedHeader({ alg: 'HS256' })
      .sign(new TextEncoder().encode(process.env.AUTH_SECRET!));
    setCookie(forged);
    await expect(requireApiAuth()).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

describe('requireTenantId', () => {
  it('returns the tenantId from the authenticated session', async () => {
    setCookie(await signValidToken());
    await expect(requireTenantId()).resolves.toBe('tnt_1');
  });

  it('returns null when there is no session', async () => {
    setCookie(null);
    await expect(requireTenantId()).resolves.toBeNull();
  });

  it('derives tenantId only from the signed session token', async () => {
    // Honest scope note: this module takes no body/query input, so nothing
    // client-supplied can influence the tenantId. Rejecting spoofed tenantId
    // is an ARCHITECTURAL invariant (endpoints derive it exclusively from the
    // authenticated session), not a behavior a unit test can assert here —
    // there is no request input to reject.
    setCookie(await signValidToken({ ...SESSION, tenantId: 'tnt_9' }));
    await expect(requireTenantId()).resolves.toBe('tnt_9');
  });
});

describe('destroySessionCookie', () => {
  it('clears the session cookie with maxAge 0 on the response', () => {
    const response = NextResponse.json({ ok: true });
    destroySessionCookie(response);
    const cookie = response.cookies.get(SESSION_COOKIE);
    expect(cookie).toBeDefined();
    expect(cookie?.value).toBe('');
    expect(cookie?.maxAge).toBe(0);
    // Flags must stay aligned with sessionCookieOptions from session-token.ts.
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe('lax');
  });
});