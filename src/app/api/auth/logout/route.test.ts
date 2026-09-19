import { describe, expect, it } from 'vitest';
import { POST } from './route';
import { SESSION_COOKIE } from '@/lib/session-token';

describe('POST /api/auth/logout', () => {
  it('responds ok:true', async () => {
    const response = await POST();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it('clears the session cookie (empty value, maxAge 0)', async () => {
    const response = await POST();
    const cookie = response.cookies.get(SESSION_COOKIE);
    expect(cookie).toBeDefined();
    expect(cookie?.value).toBe('');
    expect(cookie?.maxAge).toBe(0);
    expect(cookie?.path).toBe('/');
    // Flags must stay aligned with sessionCookieOptions from session-token.ts.
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe('lax');
  });
});