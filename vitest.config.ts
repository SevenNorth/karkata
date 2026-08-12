import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@karkata/core': resolve(import.meta.dirname, 'packages/core/src/index.ts'),
      '@karkata/openai': resolve(import.meta.dirname, 'packages/openai/src/index.ts'),
      '@karkata/javascript': resolve(import.meta.dirname, 'packages/javascript/src/index.ts'),
    },
  },
  test: {
    include: ['packages/*/src/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'html'],
    },
  },
})
