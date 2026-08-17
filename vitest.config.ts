import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@karkata-ai/core': resolve(import.meta.dirname, 'packages/core/src/index.ts'),
      '@karkata-ai/openai-compatible': resolve(import.meta.dirname, 'packages/openai-compatible/src/index.ts'),
      '@karkata-ai/javascript': resolve(import.meta.dirname, 'packages/javascript/src/index.ts'),
    },
  },
  test: {
    include: ['packages/*/src/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'html'],
    },
  },
})
