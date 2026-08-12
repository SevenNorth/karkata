import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { Agent } from './Agent.js'
import { ToolRegistry } from './ToolRegistry.js'
import type { LLMAdapter, LLMRequest, LLMResponse } from './types.js'

class ScriptedLLM implements LLMAdapter {
  readonly requests: LLMRequest[] = []
  constructor(private readonly responses: LLMResponse[]) {}
  async invoke(request: LLMRequest): Promise<LLMResponse> {
    this.requests.push({ messages: structuredClone(request.messages), tools: request.tools })
    const response = this.responses.shift()
    if (!response) throw new Error('No scripted response')
    return response
  }
}

const message = (content: string): LLMResponse => ({ message: { role: 'assistant', content } })
const toolCall = (callId: string, name: string, input: unknown): LLMResponse => ({ message: { role: 'assistant', content: null, toolCalls: [{ callId, name, input }] } })

describe('Agent', () => {
  it('executes a tool and commits a continuous conversation', async () => {
    const llm = new ScriptedLLM([toolCall('call-1', 'sum', { a: 2, b: 3 }), message('5'), message('still 5')])
    const agent = new Agent({ llm })
    agent.registerTool({ name: 'sum', description: 'Add numbers', inputSchema: z.object({ a: z.number(), b: z.number() }), execute: ({ a, b }) => a + b })

    await expect(agent.send('add')).resolves.toMatchObject({ status: 'completed', content: '5' })
    await expect(agent.send('repeat')).resolves.toMatchObject({ status: 'completed', content: 'still 5' })

    expect(llm.requests[1]!.messages.at(-1)).toEqual({ role: 'tool', callId: 'call-1', name: 'sum', content: '5', isError: false })
    expect(llm.requests[2]!.messages.some((item) => item.role === 'tool' && item.callId === 'call-1')).toBe(true)
  })

  it('does not execute a replacement using an old schema', async () => {
    let resolve!: (value: LLMResponse) => void
    const llm: LLMAdapter = { invoke: () => new Promise((done) => { resolve = done }) }
    const oldExecute = vi.fn(() => 'old')
    const newExecute = vi.fn(() => 'new')
    const agent = new Agent({ llm, maxSteps: 1 })
    agent.registerTool({ name: 'route_action', description: 'Old', inputSchema: z.object({ old: z.string() }), execute: oldExecute }, { scope: 'route' })
    const run = agent.send('go')
    await Promise.resolve()
    agent.replaceTool({ name: 'route_action', description: 'New', inputSchema: z.object({ next: z.string() }), execute: newExecute }, { scope: 'route' })
    resolve(toolCall('call-1', 'route_action', { old: 'value' }))
    await run
    expect(oldExecute).not.toHaveBeenCalled()
    expect(newExecute).not.toHaveBeenCalled()
  })

  it('settles when a tool ignores cancellation', async () => {
    const llm = new ScriptedLLM([toolCall('call-1', 'hang', {})])
    const agent = new Agent({ llm })
    agent.registerTool({ name: 'hang', description: 'Never settles', inputSchema: z.object({}), execute: () => new Promise(() => undefined) })
    const run = agent.send('hang')
    await Promise.resolve()
    agent.abort()
    await expect(run).resolves.toMatchObject({ status: 'aborted' })
  })

  it('times out an adapter that never settles', async () => {
    vi.useFakeTimers()
    const agent = new Agent({ llm: { invoke: () => new Promise(() => undefined) }, timeoutMs: 50 })
    const run = agent.send('hang')
    await vi.advanceTimersByTimeAsync(50)
    await expect(run).resolves.toMatchObject({ status: 'error', error: { code: 'TIMEOUT' } })
    vi.useRealTimers()
  })

  it('isolates subscriber errors', async () => {
    const agent = new Agent({ llm: new ScriptedLLM([message('ok')]) })
    const listener = vi.fn()
    agent.subscribe(() => { throw new Error('UI failed') })
    agent.subscribe(listener)
    await agent.send('hello')
    expect(listener).toHaveBeenCalled()
  })

  it('disposes an active run without waiting for its operation', async () => {
    const agent = new Agent({ llm: { invoke: () => new Promise(() => undefined) } })
    const run = agent.send('hang')
    await agent.dispose()
    await expect(run).resolves.toMatchObject({ status: 'aborted' })
    expect(agent.state.status).toBe('disposed')
  })
})

describe('ToolRegistry', () => {
  it('prevents an old unregister callback from deleting a replacement', () => {
    const registry = new ToolRegistry()
    const tool = { name: 'a', description: 'a', inputSchema: z.object({}), execute: () => 'a' }
    const unregister = registry.register(tool)
    registry.replace({ ...tool, execute: () => 'b' })
    expect(unregister()).toBe(false)
    expect(registry.snapshot().registrations.has('a')).toBe(true)
  })
})
