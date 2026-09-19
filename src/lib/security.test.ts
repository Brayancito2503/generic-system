import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './security';

describe('hashPassword', () => {
  it('produces a bcrypt hash different from the plaintext', async () => {
    const hash = await hashPassword('super-secret');
    expect(hash).not.toBe('super-secret');
    expect(hash).toHaveLength(60);
    expect(hash.startsWith('$2')).toBe(true);
  });

  it('produces a unique hash per call (random salt)', async () => {
    const [a, b] = await Promise.all([hashPassword('same-pass'), hashPassword('same-pass')]);
    expect(a).not.toBe(b);
  });
});

describe('verifyPassword', () => {
  it('returns true for the matching password (round-trip)', async () => {
    const hash = await hashPassword('correct horse battery staple');
    await expect(verifyPassword('correct horse battery staple', hash)).resolves.toBe(true);
  });

  it('returns false for a mismatched password', async () => {
    const hash = await hashPassword('real-password');
    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);
  });

  it('returns false for a malformed hash instead of throwing', async () => {
    await expect(verifyPassword('anything', 'not-a-bcrypt-hash')).resolves.toBe(false);
  });

  it('returns false when comparing against an empty string hash', async () => {
    await expect(verifyPassword('secret', '')).resolves.toBe(false);
  });
});