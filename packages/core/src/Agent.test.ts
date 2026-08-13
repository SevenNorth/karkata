import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { Agent } from './Agent.js'
import { ToolRegistry } from './ToolRegistry.js'
import type { InitialTool, LLMAdapter, LLMRequest, LLMResponse, Tool } from './types.js'

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
  it('executes a global tool supplied in the constructor', async () => {
    const llm = new ScriptedLLM([toolCall('call-1', 'sum', { a: 2, b: 3 }), message('5')])
    const sum: Tool<{ a: number; b: number }, number> = { name: 'sum', description: 'Add numbers', inputSchema: z.object({ a: z.number(), b: z.number() }), execute: ({ a, b }) => a + b }
    const agent = new Agent({ llm, tools: [sum] })

    await expect(agent.send('add')).resolves.toMatchObject({ status: 'completed', content: '5' })
    expect(llm.requests[0]!.tools.map(({ name }) => name)).toEqual(['sum'])
  })

  it('accepts any non-empty scope key for an initial tool', () => {
    const tool: Tool = { name: 'audit', description: 'Audit', inputSchema: z.object({}), execute: () => 'ok' }
    const agent = new Agent({ llm: new ScriptedLLM([]), tools: [{ tool, scope: 'workflow-review' }] })

    expect(agent.unregisterTool('audit', { scope: 'workflow-review' })).toBe(true)
  })

  it('rejects duplicate initial tool names across scopes', () => {
    const tool: Tool = { name: 'shared', description: 'Shared', inputSchema: z.object({}), execute: () => 'ok' }

    expect(() => new Agent({
      llm: new ScriptedLLM([]),
      tools: [tool, { tool: { ...tool }, scope: 'tenant-a' }],
    })).toThrow('Tool already registered: shared')
  })

  it('rejects an empty initial tool scope', () => {
    const tool: Tool = { name: 'audit', description: 'Audit', inputSchema: z.object({}), execute: () => 'ok' }

    expect(() => new Agent({
      llm: new ScriptedLLM([]),
      tools: [{ tool, scope: '  ' }],
    })).toThrow('Tool name, description, scope, schema, and execute are required')
  })

  it('takes an initial tool snapshot instead of retaining the input array', async () => {
    const first: Tool = { name: 'first', description: 'First', inputSchema: z.object({}), execute: () => 'first' }
    const later: Tool = { name: 'later', description: 'Later', inputSchema: z.object({}), execute: () => 'later' }
    const tools: InitialTool[] = [first]
    const llm = new ScriptedLLM([message('done')])
    const agent = new Agent({ llm, tools })
    tools.push(later)

    await agent.send('inspect')
    expect(llm.requests[0]!.tools.map(({ name }) => name)).toEqual(['first'])
  })

  it('lists tool information and filters by scope without exposing execution internals', () => {
    const globalTool: Tool = { name: 'global_tool', description: 'Global', inputSchema: z.object({}), execute: () => 'global' }
    const scopedTool: Tool = { name: 'scoped_tool', description: 'Scoped', inputSchema: z.object({ value: z.string() }), execute: () => 'scoped' }
    const agent = new Agent({ llm: new ScriptedLLM([]), tools: [globalTool, { tool: scopedTool, scope: 'workflow-review' }] })

    const all = agent.listTools()
    expect(all.map(({ name, scope }) => ({ name, scope }))).toEqual([
      { name: 'global_tool', scope: 'global' },
      { name: 'scoped_tool', scope: 'workflow-review' },
    ])
    expect(agent.listTools({ scope: 'workflow-review' })).toEqual([
      { name: 'scoped_tool', description: 'Scoped', scope: 'workflow-review' },
    ])
    expect(all[0]).not.toHaveProperty('execute')
    expect(all[0]).not.toHaveProperty('registrationId')
    expect(Object.isFrozen(all)).toBe(true)
    expect(Object.isFrozen(all[0])).toBe(true)
  })

  it('returns a detached tool list and all scopes including empty scopes', () => {
    const first: Tool = { name: 'first', description: 'First', inputSchema: z.object({}), execute: () => 'first' }
    const second: Tool = { name: 'second', description: 'Second', inputSchema: z.object({}), execute: () => 'second' }
    const agent = new Agent({ llm: new ScriptedLLM([]), tools: [{ tool: first, scope: 'plugin-a' }, { tool: second, scope: 'plugin-a' }] })
    const before = agent.listTools()

    agent.registerTool({ name: 'global', description: 'Global', inputSchema: z.object({}), execute: () => 'global' })

    expect(before.map(({ name }) => name)).toEqual(['first', 'second'])
    agent.replaceToolScope('empty-scope', [])
    expect(agent.listToolScopes()).toEqual(['global', 'plugin-a', 'empty-scope'])
    expect(Object.isFrozen(agent.listToolScopes())).toBe(true)
  })

  it('removes any tool scope including global and returns the removed count', () => {
    const tool = (name: string): Tool => ({ name, description: name, inputSchema: z.object({}), execute: () => name })
    const agent = new Agent({ llm: new ScriptedLLM([]), tools: [tool('global-a'), tool('global-b'), { tool: tool('plugin'), scope: 'plugin-a' }] })

    expect(agent.removeToolScope('global')).toBe(2)
    expect(agent.listToolScopes()).toEqual(['plugin-a'])
    expect(agent.removeToolScope('missing')).toBe(0)
    expect(agent.removeToolScope('plugin-a')).toBe(1)
    expect(agent.listTools()).toEqual([])
    expect(agent.listToolScopes()).toEqual([])
  })

  it('keeps an empty scope until it is explicitly removed', () => {
    const agent = new Agent({ llm: new ScriptedLLM([]) })

    expect(agent.listToolScopes()).toEqual(['global'])
    agent.replaceToolScope('plugin-a', [])
    expect(agent.listToolScopes()).toEqual(['global', 'plugin-a'])
    const unregister = agent.registerTool({ name: 'temporary', description: 'Temporary', inputSchema: z.object({}), execute: () => 'ok' }, { scope: 'plugin-a' })
    expect(unregister()).toBe(true)
    expect(agent.listToolScopes()).toEqual(['global', 'plugin-a'])
    expect(agent.removeToolScope('plugin-a')).toBe(0)
    expect(agent.listToolScopes()).toEqual(['global'])
  })

  it('rejects blank scope queries and rejects tool inspection after disposal', async () => {
    const agent = new Agent({ llm: new ScriptedLLM([]) })

    expect(() => agent.listTools({ scope: '  ' })).toThrow('Tool scope is required')
    expect(() => agent.removeToolScope('  ')).toThrow('Tool scope is required')
    await agent.dispose()
    expect(() => agent.listTools()).toThrow('Agent has been disposed')
    expect(() => agent.listToolScopes()).toThrow('Agent has been disposed')
    expect(() => agent.removeToolScope('global')).toThrow('Agent has been disposed')
  })

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
  it('does not partially register a batch when a later tool conflicts', () => {
    const tool = (name: string) => ({ name, description: name, inputSchema: z.object({}), execute: () => name })

    expect(() => new ToolRegistry([
      { tool: tool('first') },
      { tool: tool('first'), scope: 'plugin-a' },
    ])).toThrow('Tool already registered: first')
  })

  it('prevents an old unregister callback from deleting a replacement', () => {
    const registry = new ToolRegistry()
    const tool = { name: 'a', description: 'a', inputSchema: z.object({}), execute: () => 'a' }
    const unregister = registry.register(tool)
    registry.replace({ ...tool, execute: () => 'b' })
    expect(unregister()).toBe(false)
    expect(registry.snapshot().registrations.has('a')).toBe(true)
  })
})
