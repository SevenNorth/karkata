import { defineTool, type Tool, type ToolOutput } from '@karkata/core'
import { z } from 'zod'

export interface UnsafeJavaScriptToolOptions {
  globals?: Readonly<Record<string, unknown>>
  name?: string
  description?: string
}

export function createUnsafeJavaScriptTool(options: UnsafeJavaScriptToolOptions = {}): Tool<{ script: string }, ToolOutput> {
  const globals = Object.freeze({ ...(options.globals ?? {}) })
  const names = Object.keys(globals)
  const values = Object.values(globals)
  return defineTool({
    name: options.name ?? 'execute_javascript',
    description: options.description ?? 'Execute JavaScript in the current runtime. This is not a security sandbox.',
    inputSchema: z.object({ script: z.string().min(1) }),
    execute: async ({ script }, { signal }) => {
      signal.throwIfAborted()
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (...args: string[]) => (...values: unknown[]) => Promise<unknown>
      const fn = new AsyncFunction(...names, 'signal', `"use strict";\n${script}`)
      const result = await fn(...values, signal)
      signal.throwIfAborted()
      if (!isToolOutput(result)) throw new TypeError('JavaScript result must be a model-visible ToolOutput')
      return result
    },
  })
}

function isToolOutput(value: unknown, ancestors = new Set<object>()): value is ToolOutput {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value !== 'object') return false

  if (ancestors.has(value)) return false
  ancestors.add(value)
  try {
    if (Array.isArray(value)) return value.every((item) => isToolOutput(item, ancestors))
    const prototype = Object.getPrototypeOf(value) as unknown
    if (prototype !== Object.prototype && prototype !== null) return false
    if (Object.getOwnPropertySymbols(value).length > 0) return false
    return Object.values(value).every((item) => isToolOutput(item, ancestors))
  } finally {
    ancestors.delete(value)
  }
}
