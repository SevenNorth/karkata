import { ModelError, type AgentMessage, type AssistantMessage, type LLMAdapter, type LLMRequest, type LLMResponse, type LLMStream, type LLMStreamEvent, type TokenUsage } from '@karkata-ai/core'
import { createParser } from 'eventsource-parser'
import { z } from 'zod'

export interface OpenAICompatibleAdapterConfig {
  model: string
  baseURL: string
  apiKey?: string
  fetch?: typeof globalThis.fetch
  headers?: Record<string, string> | (() => Record<string, string> | Promise<Record<string, string>>)
  maxRetries?: number
  transformRequest?: (body: Record<string, unknown>) => Record<string, unknown>
}

const usageSchema = z.object({
  prompt_tokens: z.number().optional(),
  completion_tokens: z.number().optional(),
  total_tokens: z.number().optional(),
})

const responseSchema = z.object({
  choices: z.array(z.object({
    message: z.object({
      content: z.string().nullable().optional(),
      tool_calls: z.array(z.object({
        id: z.string().optional(),
        function: z.object({ name: z.string(), arguments: z.string() }),
      })).optional(),
    }),
  })).min(1),
  usage: usageSchema.optional(),
})

const streamChunkSchema = z.object({
  choices: z.array(z.object({
    index: z.number().int().nonnegative().optional(),
    delta: z.object({
      content: z.string().nullable().optional(),
      tool_calls: z.array(z.object({
        index: z.number().int().nonnegative(),
        id: z.string().optional(),
        function: z.object({
          name: z.string().optional(),
          arguments: z.string().optional(),
        }).optional(),
      })).optional(),
    }),
    finish_reason: z.string().nullable().optional(),
  })),
  usage: usageSchema.optional(),
})

export class OpenAICompatibleAdapter implements LLMAdapter {
  readonly #config: Required<Pick<OpenAICompatibleAdapterConfig, 'maxRetries'>> & OpenAICompatibleAdapterConfig
  readonly #fetch: typeof globalThis.fetch
  constructor(config: OpenAICompatibleAdapterConfig) {
    if (!config.model || !config.baseURL) throw new TypeError('model and baseURL are required')
    this.#config = { ...config, maxRetries: config.maxRetries ?? 2 }
    this.#fetch = (config.fetch ?? globalThis.fetch).bind(globalThis)
  }

  async invoke(request: LLMRequest, options: { signal: AbortSignal }): Promise<LLMResponse> {
    options.signal.throwIfAborted()
    const serializedBody = this.#prepareRequest(request, false)
    const response = await this.#request(serializedBody, options.signal)
    return parseResponse(response, options.signal)
  }

  stream(request: LLMRequest, options: { signal: AbortSignal }): LLMStream {
    return this.#stream(request, options)
  }

  async *#stream(request: LLMRequest, options: { signal: AbortSignal }): AsyncGenerator<LLMStreamEvent, LLMResponse, void> {
    options.signal.throwIfAborted()
    const serializedBody = this.#prepareRequest(request, true)
    const response = await this.#request(serializedBody, options.signal)
    return yield* parseStreamingResponse(response, options.signal)
  }

  #prepareRequest(request: LLMRequest, streaming: boolean): string {
    try {
      const body: Record<string, unknown> = {
        model: this.#config.model,
        messages: request.messages.map(toOpenAIMessage),
        tools: request.tools.map((tool) => ({
          type: 'function',
          function: { name: tool.name, description: tool.description, parameters: z.toJSONSchema(tool.inputSchema) },
        })),
        tool_choice: request.tools.length ? 'auto' : undefined,
        parallel_tool_calls: false,
        ...(streaming ? { stream: true } : {}),
      }
      return JSON.stringify(this.#config.transformRequest?.(body) ?? body)
    } catch (error) {
      throw new ModelError({ code: 'MODEL_PROVIDER_ERROR', message: 'Failed to prepare the model request', retryable: false, cause: error })
    }
  }

  async #request(serializedBody: string, signal: AbortSignal): Promise<Response> {
    let lastError: unknown
    for (let attempt = 0; attempt <= this.#config.maxRetries; attempt++) {
      signal.throwIfAborted()
      try {
        let dynamicHeaders: Record<string, string> | undefined
        try {
          dynamicHeaders = typeof this.#config.headers === 'function' ? await this.#config.headers() : this.#config.headers
        } catch (error) {
          throw new ModelError({ code: 'MODEL_PROVIDER_ERROR', message: 'Failed to resolve model request headers', retryable: false, cause: error })
        }

        let response: Response
        try {
          response = await this.#fetch(`${this.#config.baseURL.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST', signal,
            headers: { 'Content-Type': 'application/json', ...(this.#config.apiKey ? { Authorization: `Bearer ${this.#config.apiKey}` } : {}), ...dynamicHeaders },
            body: serializedBody,
          })
        } catch (error) {
          if (signal.aborted || isAbortError(error)) throw error
          throw new ModelError({ code: 'MODEL_NETWORK_ERROR', message: 'Model network request failed', retryable: true, cause: error })
        }

        if (!response.ok) throw modelHTTPError(response.status)
        return response
      } catch (error) {
        if (signal.aborted || isAbortError(error)) throw error
        const classified = error instanceof ModelError
          ? error
          : new ModelError({ code: 'MODEL_PROVIDER_ERROR', message: 'Model provider request failed', retryable: false, cause: error })
        if (!classified.retryable) throw classified
        lastError = classified
      }
      if (attempt < this.#config.maxRetries) await abortableDelay(100 * 2 ** attempt, signal)
    }
    throw lastError
  }
}

function modelHTTPError(statusCode: number): ModelError {
  if (statusCode === 401 || statusCode === 403) {
    return new ModelError({ code: 'MODEL_AUTH_ERROR', message: `Model authentication failed with HTTP ${statusCode}`, retryable: false, statusCode })
  }
  if (statusCode === 429) {
    return new ModelError({ code: 'MODEL_RATE_LIMIT', message: `Model rate limit exceeded with HTTP ${statusCode}`, retryable: true, statusCode })
  }
  return new ModelError({
    code: 'MODEL_PROVIDER_ERROR',
    message: `Model provider returned HTTP ${statusCode}`,
    retryable: statusCode >= 500,
    statusCode,
  })
}

async function parseResponse(response: Response, signal: AbortSignal): Promise<LLMResponse> {
  try {
    return normalizeResponse(responseSchema.parse(await response.json()))
  } catch (error) {
    if (signal.aborted || isAbortError(error)) throw error
    throw new ModelError({
      code: 'MODEL_INVALID_RESPONSE',
      message: 'Model provider returned an invalid response',
      retryable: false,
      statusCode: response.status,
      cause: error,
    })
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

function toOpenAIMessage(message: AgentMessage): Record<string, unknown> {
  switch (message.role) {
    case 'system': case 'user': return { role: message.role, content: message.content }
    case 'assistant': return {
      role: 'assistant', content: message.content,
      ...(message.toolCalls?.length ? { tool_calls: message.toolCalls.map((call) => ({ id: call.callId, type: 'function', function: { name: call.name, arguments: JSON.stringify(call.input) } })) } : {}),
    }
    case 'tool': return { role: 'tool', tool_call_id: message.callId, content: message.content }
  }
}

function normalizeResponse(data: z.infer<typeof responseSchema>): LLMResponse {
  const message = data.choices[0]!.message
  const normalized: AssistantMessage = {
    role: 'assistant', content: message.content ?? null,
    ...(message.tool_calls?.length ? { toolCalls: message.tool_calls.map((call) => ({ callId: call.id ?? globalThis.crypto.randomUUID(), name: call.function.name, input: JSON.parse(call.function.arguments) as unknown })) } : {}),
  }
  return { message: normalized, ...(data.usage ? { usage: normalizeUsage(data.usage) } : {}) }
}

interface ToolCallFragments {
  id: string
  name: string
  arguments: string
}

interface StreamAccumulator {
  readonly content: string[]
  readonly toolCalls: Map<number, ToolCallFragments>
  usage?: TokenUsage
  sawFinishReason: boolean
  sawDone: boolean
}

async function* parseStreamingResponse(
  response: Response,
  signal: AbortSignal,
): AsyncGenerator<LLMStreamEvent, LLMResponse, void> {
  if (!response.body) throw invalidStreamingResponse(response.status)
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const pendingData: string[] = []
  const accumulator: StreamAccumulator = {
    content: [],
    toolCalls: new Map(),
    sawFinishReason: false,
    sawDone: false,
  }
  let parserFailed = false
  const parser = createParser({
    maxBufferSize: 1_000_000,
    onEvent: (event) => { pendingData.push(event.data) },
    onError: () => { parserFailed = true },
  })
  let reachedEOF = false
  try {
    while (!accumulator.sawDone) {
      const result = await readWithAbort(reader, signal)
      if (result.done) {
        reachedEOF = true
        parser.feed(decoder.decode())
        parser.reset({ consume: true })
      } else {
        parser.feed(decoder.decode(result.value, { stream: true }))
      }
      if (parserFailed) throw invalidStreamingResponse(response.status)
      for (const data of pendingData.splice(0)) {
        if (data === '[DONE]') {
          accumulator.sawDone = true
          break
        }
        for (const event of normalizeStreamChunk(data, accumulator, response.status)) yield event
      }
      if (reachedEOF) break
    }
    if (!accumulator.sawDone && !accumulator.sawFinishReason) {
      throw invalidStreamingResponse(response.status)
    }
    return finalizeStream(accumulator, response.status)
  } catch (error) {
    if (signal.aborted || isAbortError(error)) throw error
    if (error instanceof ModelError) throw error
    throw new ModelError({
      code: 'MODEL_NETWORK_ERROR',
      message: 'Model response stream failed',
      retryable: true,
      cause: error,
    })
  } finally {
    if (!reachedEOF) {
      try { void reader.cancel().catch(() => undefined) } catch { /* Ignore response body cleanup. */ }
    }
    try { reader.releaseLock() } catch { /* Ignore response body cleanup. */ }
  }
}

function normalizeStreamChunk(
  data: string,
  accumulator: StreamAccumulator,
  statusCode: number,
): LLMStreamEvent[] {
  let parsed: z.infer<typeof streamChunkSchema>
  try {
    parsed = streamChunkSchema.parse(JSON.parse(data) as unknown)
  } catch (error) {
    throw invalidStreamingResponse(statusCode, error)
  }
  if (parsed.usage) accumulator.usage = normalizeUsage(parsed.usage)
  const events: LLMStreamEvent[] = []
  for (const choice of parsed.choices) {
    if ((choice.index ?? 0) !== 0) continue
    if (choice.finish_reason) accumulator.sawFinishReason = true
    const content = choice.delta.content
    if (content) {
      accumulator.content.push(content)
      events.push({ type: 'text_delta', delta: content })
    }
    for (const fragment of choice.delta.tool_calls ?? []) {
      const current = accumulator.toolCalls.get(fragment.index) ?? { id: '', name: '', arguments: '' }
      if (fragment.id) current.id += fragment.id
      if (fragment.function?.name) current.name += fragment.function.name
      if (fragment.function?.arguments) current.arguments += fragment.function.arguments
      accumulator.toolCalls.set(fragment.index, current)
    }
  }
  return events
}

function finalizeStream(accumulator: StreamAccumulator, statusCode: number): LLMResponse {
  const content = accumulator.content.join('')
  const toolCalls = [...accumulator.toolCalls.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, fragments]) => {
      if (!fragments.name || !fragments.arguments) throw invalidStreamingResponse(statusCode)
      try {
        return {
          callId: fragments.id || globalThis.crypto.randomUUID(),
          name: fragments.name,
          input: JSON.parse(fragments.arguments) as unknown,
        }
      } catch (error) {
        throw invalidStreamingResponse(statusCode, error)
      }
    })
  if (!content && toolCalls.length === 0) throw invalidStreamingResponse(statusCode)
  return {
    message: {
      role: 'assistant',
      content: content || null,
      ...(toolCalls.length ? { toolCalls } : {}),
    },
    ...(accumulator.usage ? { usage: accumulator.usage } : {}),
  }
}

function invalidStreamingResponse(statusCode: number, cause?: unknown): ModelError {
  return new ModelError({
    code: 'MODEL_INVALID_RESPONSE',
    message: 'Model provider returned an invalid streaming response',
    retryable: false,
    statusCode,
    cause,
  })
}

function normalizeUsage(usage: z.infer<typeof usageSchema>): TokenUsage {
  return {
    inputTokens: usage.prompt_tokens,
    outputTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
  }
}

function readWithAbort(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal: AbortSignal,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      try { void reader.cancel().catch(() => undefined) } catch { /* Ignore response body cleanup. */ }
      reject(signal.reason ?? new DOMException('The operation was aborted', 'AbortError'))
    }
    signal.addEventListener('abort', onAbort, { once: true })
    reader.read().then(
      (result) => { signal.removeEventListener('abort', onAbort); resolve(result) },
      (error: unknown) => { signal.removeEventListener('abort', onAbort); reject(error) },
    )
  })
}

function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('The operation was aborted', 'AbortError')) }, { once: true })
  })
}
