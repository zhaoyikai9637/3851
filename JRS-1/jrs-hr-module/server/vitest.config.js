import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.js'], exclude:['tests/mysql.test.js'], restoreMocks: true,
    clearMocks: true, testTimeout: 10000 }
});
