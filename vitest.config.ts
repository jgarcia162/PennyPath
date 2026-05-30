import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.js'],
    exclude: ['node_modules', '.next', 'dist', 'packages/**'],
    reporters: ['verbose'],
    coverage: {
      provider: 'v8',
      include: [
        'assets/financial-plan/payoff-projection.js',
        'assets/financial-plan/ledger-utils.ts',
        'assets/financial-plan/utils.ts',
        'lib/agent/scopes.ts',
        'lib/agent/validate.ts',
        'lib/agent/token-crypto.ts',
        'lib/agent/http.ts',
        'lib/agent/data-access.ts',
      ],
      reporter: ['text', 'lcov'],
    },
  },
});
