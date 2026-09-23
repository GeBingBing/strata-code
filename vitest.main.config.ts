import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: {
    name: 'main',
    environment: 'node',
    include: ['tests/main/**/*.test.ts', 'tests/mocks/**/*.test.ts'],
    globals: false
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@main': resolve(__dirname, 'src/main')
    }
  }
})
