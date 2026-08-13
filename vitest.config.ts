import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@karkata/core': resolve(import.meta.dirname, 'packages/core/src/index.ts'),
      '@karkata/openai-compatible': resolve(import.meta.dirname, 'packages/openai-compatible/src/index.ts'),
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
