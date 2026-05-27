import { defineConfig } from 'vitest/config';

// Default config: tests under tests/ excluding tests/e2e/ (which needs a
// running MCP HTTP server and has its own config in vitest.e2e.config.ts).
export default defineConfig({
  test: {
    include: ['tests/**/*.{test,spec}.ts'],
    exclude: ['node_modules', 'dist', 'tests/e2e/**'],
  },
});
