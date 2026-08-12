import { defineTool, type Tool } from '@karkata/core'
import { z } from 'zod'

export interface JavaScriptToolOptions {
  globals?: Readonly<Record<string, unknown>>
  name?: string
  description?: string
}

export function createJavaScriptTool(options: JavaScriptToolOptions = {}): Tool<{ script: string }, unknown> {
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
      return result
    },
  })
}

