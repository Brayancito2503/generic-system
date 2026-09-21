import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SignJWT } from 'jose';
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  signSession,
  verifySessionToken,
  type SessionPayload,
  type SessionRole,
} from './session-token';

// Guaranteed by src/test/setup.ts (runs before test modules are imported).
const TEST_SECRET = new TextEncoder().encode(process.env.AUTH_SECRET!);

function makePayload(overrides: Partial<SessionPayload> = {}): SessionPayload {
  return {
    userId: 'usr_1',
    tenantId: 'tnt_1',
    role: 'CUSTOMER',
    name: 'Ana Lopez',
    email: 'ana@example.com',
    ...overrides,
  };
}

async function signRaw(payload: Record<string, unknown>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(typeof payload.userId === 'string' ? payload.userId : 'unknown')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(TEST_SECRET);
}

const ALL_ROLES: SessionRole[] = [
  'SUPER_ADMIN',
  'TENANT_ADMIN',
  'STAFF',
  'CUSTOMER',
  'CASHIER',
  'ACCOUNTANT',
];

describe('signSession', () => {
  it('signs a token that round-trips through verifySessionToken with all fields intact', async () => {
    const payload = makePayload();
    const token = await signSession(payload);
    expect(token).toBeTruthy();
    await expect(verifySessionToken(token)).resolves.toEqual(payload);
  });

  it.each(ALL_ROLES)('round-trips for role %s', async (role) => {
    const payload = makePayload({ role });
    const token = await signSession(payload);
    await expect(verifySessionToken(token)).resolves.toEqual(payload);
  });

  it('sets the JWT subject to the userId', async () => {
    const token = await signSession(makePayload());
    const [, rawPayload] = token.split('.');
    const decoded = JSON.parse(Buffer.from(rawPayload, 'base64url').toString());
    expect(decoded.sub).toBe('usr_1');
  });
});

describe('verifySessionToken', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-17T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null for a token signed with a different secret', async () => {
    const foreign = await new SignJWT({ ...makePayload() })
      .setProtectedHeader({ alg: 'HS256' })
      .sign(new TextEncoder().encode('some-other-secret'));
    await expect(verifySessionToken(foreign)).resolves.toBeNull();
  });

  it('returns null for a tampered token', async () => {
    const token = await signSession(makePayload());
    const tampered = token.slice(0, -2) + (token.endsWith('aa') ? 'bb' : 'aa');
    await expect(verifySessionToken(tampered)).resolves.toBeNull();
  });

  it('returns null for an expired token', async () => {
    const token = await signSession(makePayload()); // 7-day max age from now
    vi.setSystemTime(new Date('2026-09-25T12:00:00Z')); // 8 days later
    await expect(verifySessionToken(token)).resolves.toBeNull();
  });

  it('returns null for a garbage string', async () => {
    await expect(verifySessionToken('not-a-jwt')).resolves.toBeNull();
  });

  it('returns null when tenantId claim is missing', async () => {
    const token = await signRaw({ userId: 'usr_1', role: 'CUSTOMER' });
    await expect(verifySessionToken(token)).resolves.toBeNull();
  });

  it('returns null when role claim is missing', async () => {
    const token = await signRaw({ userId: 'usr_1', tenantId: 'tnt_1' });
    await expect(verifySessionToken(token)).resolves.toBeNull();
  });

  it('returns null when userId claim is missing', async () => {
    const token = await signRaw({ tenantId: 'tnt_1', role: 'CUSTOMER' });
    await expect(verifySessionToken(token)).resolves.toBeNull();
  });

  it('returns null when the role claim is not a real SessionRole value', async () => {
    const token = await signRaw({ userId: 'usr_1', tenantId: 'tnt_1', role: 'GOD' });
    await expect(verifySessionToken(token)).resolves.toBeNull();
  });

  it('rejects a forged token that uses an unexpected algorithm (alg:none)', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString(
      'base64url'
    );
    const body = Buffer.from(JSON.stringify({ ...makePayload(), sub: 'usr_1' })).toString(
      'base64url'
    );
    await expect(verifySessionToken(`${header}.${body}.`)).resolves.toBeNull();
  });

  it('defaults missing name/email to empty strings', async () => {
    const token = await signRaw({ userId: 'usr_1', tenantId: 'tnt_1', role: 'STAFF' });
    await expect(verifySessionToken(token)).resolves.toEqual({
      userId: 'usr_1',
      tenantId: 'tnt_1',
      role: 'STAFF',
      name: '',
      email: '',
    });
  });
});

describe('sessionCookieOptions', () => {
  it('exposes secure, http-only session cookie settings', () => {
    expect(sessionCookieOptions.httpOnly).toBe(true);
    expect(sessionCookieOptions.sameSite).toBe('lax');
    expect(sessionCookieOptions.path).toBe('/');
    expect(sessionCookieOptions.maxAge).toBe(60 * 60 * 24 * 7);
    // Vitest runs with NODE_ENV=test, never production.
    expect(sessionCookieOptions.secure).toBe(false);
  });

  it('exports the session cookie name used by the rest of the app', () => {
    expect(SESSION_COOKIE).toBe('gs_session');
  });
});