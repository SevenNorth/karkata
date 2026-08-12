import { describe, expect, it } from 'vitest'
import { createJavaScriptTool } from './createJavaScriptTool.js'

describe('createJavaScriptTool', () => {
  it('exposes only explicitly supplied globals as parameters', async () => {
    const tool = createJavaScriptTool({ globals: { value: 4 } })
    const result = await tool.execute({ script: 'return value * 2' }, { signal: new AbortController().signal, runId: 'run', step: 1 })
    expect(result).toBe(8)
  })
})

