import { defineConfig } from 'vitest/config';

export default defineConfig({
  oxc: {
    decorator: { legacy: true, emitDecoratorMetadata: true },
  },
  test: {
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    setupFiles: ['./test/support/e2e-env.ts'],
    environment: 'node',
    // Todas las suites comparten la base de test: se ejecutan de a una.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
