import { ModelError, type AgentMessage, type AssistantMessage, type LLMAdapter, type LLMRequest, type LLMResponse } from '@karkata/core'
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
  usage: z.object({ prompt_tokens: z.number().optional(), completion_tokens: z.number().optional(), total_tokens: z.number().optional() }).optional(),
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
    let serializedBody: string
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
      }
      serializedBody = JSON.stringify(this.#config.transformRequest?.(body) ?? body)
    } catch (error) {
      throw new ModelError({ code: 'MODEL_PROVIDER_ERROR', message: 'Failed to prepare the model request', retryable: false, cause: error })
    }

    let lastError: unknown
    for (let attempt = 0; attempt <= this.#config.maxRetries; attempt++) {
      options.signal.throwIfAborted()
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
            method: 'POST', signal: options.signal,
            headers: { 'Content-Type': 'application/json', ...(this.#config.apiKey ? { Authorization: `Bearer ${this.#config.apiKey}` } : {}), ...dynamicHeaders },
            body: serializedBody,
          })
        } catch (error) {
          if (options.signal.aborted || isAbortError(error)) throw error
          throw new ModelError({ code: 'MODEL_NETWORK_ERROR', message: 'Model network request failed', retryable: true, cause: error })
        }

        if (!response.ok) throw modelHTTPError(response.status)
        return await parseResponse(response, options.signal)
      } catch (error) {
        if (options.signal.aborted || isAbortError(error)) throw error
        const classified = error instanceof ModelError
          ? error
          : new ModelError({ code: 'MODEL_PROVIDER_ERROR', message: 'Model provider request failed', retryable: false, cause: error })
        if (!classified.retryable) throw classified
        lastError = classified
      }
      if (attempt < this.#config.maxRetries) await abortableDelay(100 * 2 ** attempt, options.signal)
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
  return { message: normalized, ...(data.usage ? { usage: { inputTokens: data.usage.prompt_tokens, outputTokens: data.usage.completion_tokens, totalTokens: data.usage.total_tokens } } : {}) }
}

function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('The operation was aborted', 'AbortError')) }, { once: true })
  })
}
