import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { OpenAIAdapter } from './OpenAIAdapter.js'

describe('OpenAIAdapter', () => {
  it('normalizes tool calls and request messages', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: null, tool_calls: [{ id: 'c1', function: { name: 'lookup', arguments: '{"id":"1"}' } }] } }], usage: { total_tokens: 12 } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const adapter = new OpenAIAdapter({ model: 'test', baseURL: 'https://llm.test/v1/', fetch })
    const result = await adapter.invoke({ messages: [{ role: 'user', content: 'find' }], tools: [{ name: 'lookup', description: 'Lookup', inputSchema: z.object({ id: z.string() }) }] }, { signal: new AbortController().signal })
    expect(result.message.toolCalls?.[0]).toEqual({ callId: 'c1', name: 'lookup', input: { id: '1' } })
    expect(fetch).toHaveBeenCalledWith('https://llm.test/v1/chat/completions', expect.objectContaining({ method: 'POST' }))
  })

  it('does not retry a non-retryable 4xx response', async () => {
    const fetch = vi.fn(async () => new Response('bad request', { status: 400 }))
    const adapter = new OpenAIAdapter({ model: 'test', baseURL: 'https://llm.test/v1', fetch, maxRetries: 2 })
    await expect(adapter.invoke({ messages: [{ role: 'user', content: 'find' }], tools: [] }, { signal: new AbortController().signal })).rejects.toThrow('HTTP 400')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
