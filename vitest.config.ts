import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const srcDir = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // Mirrors tsconfig paths `@/*` -> `src/*`
      '@': srcDir,
      // `server-only` throws when imported outside a React Server Component
      // runtime. Stub it so logic suites can import modules that use it.
      'server-only': fileURLToPath(
        new URL('./src/test/stubs/server-only.ts', import.meta.url)
      ),
    },
  },
  test: {
    // Node by default. Component suites opt into jsdom per file with
    // `// @vitest-environment jsdom`.
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: [
        'src/lib/session-token.ts',
        'src/lib/session.ts',
        'src/lib/security.ts',
        'src/utils/formatters.ts',
        'src/modules/gym/use-cases/check-in-access.use-case.ts',
        'src/app/api/auth/logout/route.ts',
      ],
    },
  },
});