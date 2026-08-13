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
})
