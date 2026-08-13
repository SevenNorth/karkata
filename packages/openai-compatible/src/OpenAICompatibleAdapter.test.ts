import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { z } from 'zod'
import { Agent } from '@karkata/core'
import { createAgent, type OpenAICompatibleCreateAgentConfig, OpenAICompatibleAdapter } from './index.js'

describe('createAgent', () => {
  it('keeps the adapter owned by the provider factory', () => {
    expectTypeOf<NonNullable<OpenAICompatibleCreateAgentConfig['agent']>>().not.toHaveProperty('llm')
  })

  it('creates a core Agent from provider and runtime configuration', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: 'done' } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const agent = createAgent({
      model: 'test-model',
      baseURL: 'https://llm.test/v1/',
      apiKey: 'secret',
      fetch,
      agent: { systemPrompt: 'Reply briefly' },
    })

    expect(agent).toBeInstanceOf(Agent)
    await expect(agent.send('help')).resolves.toMatchObject({ status: 'completed', content: 'done' })
    expect(fetch).toHaveBeenCalledOnce()

    const [url, init] = fetch.mock.calls[0]!
    expect(url).toBe('https://llm.test/v1/chat/completions')
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer secret' })
    const body = JSON.parse(String(init?.body)) as { model: string; messages: Array<{ role: string; content: string }> }
    expect(body.model).toBe('test-model')
    expect(body.messages[0]).toMatchObject({ role: 'system', content: expect.stringContaining('Reply briefly') })
  })
})

describe('OpenAICompatibleAdapter', () => {
  it('normalizes tool calls and request messages', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: null, tool_calls: [{ id: 'c1', function: { name: 'lookup', arguments: '{"id":"1"}' } }] } }], usage: { total_tokens: 12 } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const adapter = new OpenAICompatibleAdapter({ model: 'test', baseURL: 'https://llm.test/v1/', fetch })
    const result = await adapter.invoke({ messages: [{ role: 'user', content: 'find' }], tools: [{ name: 'lookup', description: 'Lookup', inputSchema: z.object({ id: z.string() }) }] }, { signal: new AbortController().signal })
    expect(result.message.toolCalls?.[0]).toEqual({ callId: 'c1', name: 'lookup', input: { id: '1' } })
    expect(fetch).toHaveBeenCalledWith('https://llm.test/v1/chat/completions', expect.objectContaining({ method: 'POST' }))
  })

  it('does not retry a non-retryable 4xx response', async () => {
    const fetch = vi.fn(async () => new Response('bad request', { status: 400 }))
    const adapter = new OpenAICompatibleAdapter({ model: 'test', baseURL: 'https://llm.test/v1', fetch, maxRetries: 2 })
    await expect(adapter.invoke({ messages: [{ role: 'user', content: 'find' }], tools: [] }, { signal: new AbortController().signal })).rejects.toThrow('HTTP 400')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
