import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'tests/unit/**/*.test.ts',
      'tests/integration/**/*.test.ts',
      'tests/briefing-intelligence/unit/**/*.test.ts',
      'tests/briefing-intelligence/integration/**/*.test.ts',
    ],
    exclude: ['tests/firestore/**', 'tests/briefing-intelligence/firestore-rules/**', 'tests/e2e/**', 'node_modules/**'],
    reporters: ['default'],
    // JSON adapter tests share backend/data/*.json; parallel files race the same request store.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
