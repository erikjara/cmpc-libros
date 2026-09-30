import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: false,
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      css: false,
      // Margen para hosts o CI con carga alta: los flujos completos (guardar + imagen + navegar) superan 5 s.
      testTimeout: 15_000,
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/components/ui/**',
          'src/main.tsx',
          'src/test/**',
          '**/*.test.*',
          'src/vite-env.d.ts',
        ],
        reporter: ['text', 'html', 'lcov'],
        thresholds: { lines: 80, branches: 80, functions: 80, statements: 80 },
      },
    },
  }),
)
