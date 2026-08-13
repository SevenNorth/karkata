import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { z } from 'zod'
import { Agent, ModelError } from '@karkata/core'
import { createAgent, type OpenAICompatibleCreateAgentConfig, OpenAICompatibleAdapter } from './index.js'

const request = { messages: [{ role: 'user' as const, content: 'find' }], tools: [] }
const signal = new AbortController().signal
const successResponse = () => new Response(JSON.stringify({ choices: [{ message: { content: 'done' } }] }), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
})

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

  it('exposes a classified provider failure through the core agent without leaking secrets', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ error: { message: 'response-secret' } }), { status: 401 }))
    const agent = createAgent({
      model: 'test-model',
      baseURL: 'https://llm.test/v1',
      apiKey: 'api-secret',
      fetch,
    })

    await expect(agent.send('help')).resolves.toMatchObject({
      status: 'error',
      error: {
        code: 'MODEL_AUTH_ERROR',
        message: 'Model authentication failed with HTTP 401',
        retryable: false,
        statusCode: 401,
      },
    })
    expect(JSON.stringify(agent.state)).not.toContain('response-secret')
    expect(JSON.stringify(agent.state)).not.toContain('api-secret')
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

  it.each([
    [401, 'MODEL_AUTH_ERROR', false],
    [403, 'MODEL_AUTH_ERROR', false],
    [429, 'MODEL_RATE_LIMIT', true],
    [500, 'MODEL_PROVIDER_ERROR', true],
    [503, 'MODEL_PROVIDER_ERROR', true],
    [418, 'MODEL_PROVIDER_ERROR', false],
  ] as const)('maps HTTP %i to %s without exposing the response body', async (statusCode, code, retryable) => {
    const secret = 'response-secret-marker'
    const fetch = vi.fn(async () => new Response(JSON.stringify({ error: { message: secret } }), { status: statusCode }))
    const adapter = new OpenAICompatibleAdapter({ model: 'test', baseURL: 'https://llm.test/v1', apiKey: 'api-secret-marker', fetch, maxRetries: 0 })

    const error = await adapter.invoke(request, { signal }).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ModelError)
    expect(error).toMatchObject({ code, retryable, statusCode })
    expect(String(error)).not.toContain(secret)
    expect(JSON.stringify(error)).not.toContain(secret)
    expect(JSON.stringify(error)).not.toContain('api-secret-marker')
    expect(fetch).toHaveBeenCalledOnce()
  })

  it.each([
    ['network failure', () => Promise.reject(new TypeError('ECONNRESET')), 'MODEL_NETWORK_ERROR'],
    ['rate limit', () => Promise.resolve(new Response('', { status: 429 })), 'MODEL_RATE_LIMIT'],
    ['server failure', () => Promise.resolve(new Response('', { status: 503 })), 'MODEL_PROVIDER_ERROR'],
  ] as const)('retries a %s once and returns a later success', async (_label, firstAttempt, code) => {
    const fetch = vi.fn()
      .mockImplementationOnce(firstAttempt)
      .mockImplementationOnce(successResponse)
    const adapter = new OpenAICompatibleAdapter({ model: 'test', baseURL: 'https://llm.test/v1', fetch, maxRetries: 1 })

    await expect(adapter.invoke(request, { signal })).resolves.toMatchObject({ message: { content: 'done' } })
    expect(fetch).toHaveBeenCalledTimes(2)

    const failingFetch = vi.fn(firstAttempt)
    const failingAdapter = new OpenAICompatibleAdapter({ model: 'test', baseURL: 'https://llm.test/v1', fetch: failingFetch, maxRetries: 0 })
    await expect(failingAdapter.invoke(request, { signal })).rejects.toMatchObject({ code, retryable: true })
  })

  it.each([
    ['invalid JSON', () => new Response('not-json', { status: 200 }), 'MODEL_INVALID_RESPONSE'],
    ['invalid schema', () => new Response(JSON.stringify({ choices: [] }), { status: 200 }), 'MODEL_INVALID_RESPONSE'],
    ['invalid tool arguments', () => new Response(JSON.stringify({ choices: [{ message: { content: null, tool_calls: [{ id: 'c1', function: { name: 'lookup', arguments: 'not-json' } }] } }] }), { status: 200 }), 'MODEL_INVALID_RESPONSE'],
  ] as const)('does not retry an %s response', async (_label, response, code) => {
    const fetch = vi.fn(async () => response())
    const adapter = new OpenAICompatibleAdapter({ model: 'test', baseURL: 'https://llm.test/v1', fetch, maxRetries: 2 })

    await expect(adapter.invoke(request, { signal })).rejects.toMatchObject({ code, retryable: false, statusCode: 200 })
    expect(fetch).toHaveBeenCalledOnce()
  })

  it.each([
    ['headers resolver', { headers: () => { throw new Error('header-secret-marker') } }],
    ['request transform', { transformRequest: () => { throw new Error('request-secret-marker') } }],
  ])('classifies a failing %s as a safe non-retryable provider error', async (_label, config) => {
    const fetch = vi.fn(successResponse)
    const adapter = new OpenAICompatibleAdapter({ model: 'test', baseURL: 'https://llm.test/v1', fetch, maxRetries: 2, ...config })

    const error = await adapter.invoke(request, { signal }).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ModelError)
    expect(error).toMatchObject({ code: 'MODEL_PROVIDER_ERROR', retryable: false })
    expect(String(error)).not.toContain('secret-marker')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('propagates fetch cancellation without classifying or retrying it', async () => {
    const abortError = new DOMException('The operation was aborted', 'AbortError')
    const fetch = vi.fn(async () => Promise.reject(abortError))
    const adapter = new OpenAICompatibleAdapter({ model: 'test', baseURL: 'https://llm.test/v1', fetch, maxRetries: 2 })

    await expect(adapter.invoke(request, { signal })).rejects.toBe(abortError)
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('propagates response-read cancellation without classifying or retrying it', async () => {
    const abortError = new DOMException('The operation was aborted', 'AbortError')
    const response = { ok: true, status: 200, json: () => Promise.reject(abortError) } as Response
    const fetch = vi.fn(async () => response)
    const adapter = new OpenAICompatibleAdapter({ model: 'test', baseURL: 'https://llm.test/v1', fetch, maxRetries: 2 })

    await expect(adapter.invoke(request, { signal })).rejects.toBe(abortError)
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('does not prepare a request when the signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const transformRequest = vi.fn((body: Record<string, unknown>) => body)
    const headers = vi.fn(() => ({}))
    const fetch = vi.fn(successResponse)
    const adapter = new OpenAICompatibleAdapter({
      model: 'test',
      baseURL: 'https://llm.test/v1',
      transformRequest,
      headers,
      fetch,
    })

    await expect(adapter.invoke(request, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
    expect(transformRequest).not.toHaveBeenCalled()
    expect(headers).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })
})
