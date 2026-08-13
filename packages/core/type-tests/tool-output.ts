import { z } from 'zod'
import { defineTool, type ToolOutput } from '../src/index.js'

const base = {
  name: 'action',
  description: 'Perform an action',
  inputSchema: z.object({}),
}

const output: ToolOutput = {
  success: true,
  details: { ids: ['1', '2'], note: null },
}

defineTool({ ...base, execute: () => output })
defineTool({ ...base, execute: async () => output })

interface ActionResult {
  success: boolean
  details: { id: string; note: string | null }
}

const actionResult: ActionResult = { success: true, details: { id: '1', note: null } }
defineTool({ ...base, execute: () => actionResult })

// @ts-expect-error A successful tool must return a model-visible value.
defineTool({
  ...base,
  execute: () => undefined,
})

// @ts-expect-error An async successful tool must not resolve to void.
defineTool({
  ...base,
  execute: async () => { await Promise.resolve() },
})

// @ts-expect-error bigint is not model-visible output.
defineTool({
  ...base,
  execute: () => 1n,
})

// @ts-expect-error functions are not model-visible output.
defineTool({
  ...base,
  execute: () => () => true,
})

// @ts-expect-error symbols are not model-visible output.
defineTool({
  ...base,
  execute: () => Symbol('result'),
})

// @ts-expect-error undefined object properties would be silently omitted by JSON serialization.
defineTool({
  ...base,
  execute: () => ({ success: true, details: undefined }),
})
