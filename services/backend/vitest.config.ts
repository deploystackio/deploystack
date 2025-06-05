import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    exclude: ['tests/e2e/**/*'],
    watch: false, // Disable watch mode by default
    testTimeout: 10000, // 10 seconds timeout for unit tests
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/test/**',
        'src/types/**',
        'src/plugins/example-plugin/**', // Exclude example plugin
        'src/email/example.ts', // Exclude email examples
        'src/index.ts', // Entry point
        'src/server.ts', // Server setup
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@src': new URL('./src', import.meta.url).pathname,
    },
  },
});
