import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    exclude: ['tests/e2e/**/*'],
    watch: false, // Disable watch mode by default
  },
  resolve: {
    alias: {
      '@src': new URL('./src', import.meta.url).pathname,
    },
  },
});
