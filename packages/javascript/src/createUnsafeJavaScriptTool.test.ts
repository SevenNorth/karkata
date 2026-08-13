import { describe, expect, it } from 'vitest'
import * as javascriptPackage from './index.js'
import { createUnsafeJavaScriptTool } from './index.js'

describe('createUnsafeJavaScriptTool', () => {
  it('does not expose the old factory name', () => {
    expect(javascriptPackage).not.toHaveProperty('createJavaScriptTool')
  })

  it('exposes supplied globals as parameters', async () => {
    const tool = createUnsafeJavaScriptTool({ globals: { value: 4 } })
    const result = await tool.execute({ script: 'return value * 2' }, { signal: new AbortController().signal, runId: 'run', step: 1 })
    expect(result).toBe(8)
  })

  it('returns recursively composed model-visible values', async () => {
    const tool = createUnsafeJavaScriptTool()
    const result = await tool.execute(
      { script: 'return { success: true, details: { ids: [1, 2], note: null } }' },
      { signal: new AbortController().signal, runId: 'run', step: 1 },
    )

    expect(result).toEqual({ success: true, details: { ids: [1, 2], note: null } })
  })

  it.each([
    ['undefined', 'return undefined'],
    ['function', 'return () => true'],
    ['symbol', "return Symbol('result')"],
    ['bigint', 'return 1n'],
    ['non-finite number', 'return Infinity'],
    ['class instance', 'return new (class Result { constructor() { this.value = 1 } })()'],
  ])('rejects a %s result', async (_label, script) => {
    const tool = createUnsafeJavaScriptTool()

    await expect(tool.execute(
      { script },
      { signal: new AbortController().signal, runId: 'run', step: 1 },
    )).rejects.toThrow('JavaScript result must be a model-visible ToolOutput')
  })

  it('rejects a circular result', async () => {
    const tool = createUnsafeJavaScriptTool()

    await expect(tool.execute(
      { script: 'const result = {}; result.self = result; return result' },
      { signal: new AbortController().signal, runId: 'run', step: 1 },
    )).rejects.toThrow('JavaScript result must be a model-visible ToolOutput')
  })
})
