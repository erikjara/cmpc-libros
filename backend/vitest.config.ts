import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Nest necesita decoradores "legacy" y metadatos de tipos (design:paramtypes) para la DI.
  oxc: {
    decorator: { legacy: true, emitDecoratorMetadata: true },
  },
  test: {
    root: './',
    include: ['src/**/*.spec.ts', 'prisma/**/*.spec.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/main.ts',
        'src/**/*.module.ts',
        'src/**/dto/**',
        'src/generated/**',
        'src/testing/**',
        'src/**/*.spec.ts',
        'prisma/**',
      ],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      },
    },
  },
});
