import { defineConfig } from 'vitest/config';

// E2E config — only the tests/e2e suite. Assumes the MCP HTTP server is
// already listening at E2E_BASE_URL (default http://localhost:4400).
// See .github/workflows/e2e.yml.
export default defineConfig({
  test: {
    include: ['tests/e2e/**/*.{test,spec}.ts'],
    testTimeout: 15_000,
  },
});
