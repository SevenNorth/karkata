import type { AgentMessage, AssistantMessage, LLMAdapter, LLMRequest, LLMResponse } from '@karkata/core'
import { z } from 'zod'

export interface OpenAIAdapterConfig {
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

export class OpenAIAdapter implements LLMAdapter {
  readonly #config: Required<Pick<OpenAIAdapterConfig, 'maxRetries'>> & OpenAIAdapterConfig
  readonly #fetch: typeof globalThis.fetch
  constructor(config: OpenAIAdapterConfig) {
    if (!config.model || !config.baseURL) throw new TypeError('model and baseURL are required')
    this.#config = { ...config, maxRetries: config.maxRetries ?? 2 }
    this.#fetch = (config.fetch ?? globalThis.fetch).bind(globalThis)
  }

  async invoke(request: LLMRequest, options: { signal: AbortSignal }): Promise<LLMResponse> {
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
    const finalBody = this.#config.transformRequest?.(body) ?? body
    let lastError: unknown
    for (let attempt = 0; attempt <= this.#config.maxRetries; attempt++) {
      options.signal.throwIfAborted()
      try {
        const dynamicHeaders = typeof this.#config.headers === 'function' ? await this.#config.headers() : this.#config.headers
        const response = await this.#fetch(`${this.#config.baseURL.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST', signal: options.signal,
          headers: { 'Content-Type': 'application/json', ...(this.#config.apiKey ? { Authorization: `Bearer ${this.#config.apiKey}` } : {}), ...dynamicHeaders },
          body: JSON.stringify(finalBody),
        })
        if (!response.ok) {
          const error = new OpenAIHTTPError(response.status, `OpenAI-compatible API returned HTTP ${response.status}: ${await response.text()}`)
          if (!error.retryable) throw error
          lastError = error
        } else {
          return normalizeResponse(responseSchema.parse(await response.json()))
        }
      } catch (error) {
        if (options.signal.aborted || (error as { name?: string }).name === 'AbortError') throw error
        if (error instanceof OpenAIHTTPError && !error.retryable) throw error
        lastError = error
      }
      if (attempt < this.#config.maxRetries) await abortableDelay(100 * 2 ** attempt, options.signal)
    }
    throw lastError
  }
}

class OpenAIHTTPError extends Error {
  readonly retryable: boolean
  constructor(readonly status: number, message: string) {
    super(message)
    this.name = 'OpenAIHTTPError'
    this.retryable = status === 429 || status >= 500
  }
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
