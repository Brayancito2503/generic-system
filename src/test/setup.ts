import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

/**
 * Session suites fall back to this fixed, deterministic secret unless
 * AUTH_SECRET is explicitly provided in the environment — if it is, that
 * value wins (the `??` below respects it). Tests never depend on .env state.
 */
process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? 'test-only-secret-do-not-use-in-prod';

// @testing-library/react only auto-cleans with vitest `globals: true`;
// this setup runs for every test file regardless of environment.
afterEach(() => {
  cleanup();
});