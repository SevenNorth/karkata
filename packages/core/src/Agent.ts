import { awaitWithAbort } from './abort.js'
import { AgentBusyError, AgentDisposedError, errorMessage, ModelError } from './errors.js'
import { assembleSystemMessage, createInstructionResolverContext, PromptAssemblyError } from './prompt.js'
import { ToolRegistry, type ToolRegistration } from './ToolRegistry.js'
import { serializeToolOutput } from './toolOutput.js'
import type { AgentConfig, AgentError, AgentMessage, AgentResult, AgentState, AgentStateListener, AssistantMessage, ContextEstimationContext, InitialTool, LLMRequest, RegisteredToolInfo, Tool, ToolResultMessage, UserMessage } from './types.js'

interface Run { runId: string; controller: AbortController; termination: 'manual' | 'timeout' | 'dispose' | undefined; timer: ReturnType<typeof setTimeout>; step: number }

class ContextEstimationError extends Error {
  override readonly name = 'ContextEstimationError'
}

export class Agent {
  readonly #config: Required<Pick<AgentConfig, 'maxSteps' | 'timeoutMs' | 'maxToolResultLength' | 'maxInstructionsLength'>> & AgentConfig
  readonly #registry: ToolRegistry
  readonly #listeners = new Set<AgentStateListener>()
  #history: AgentMessage[] = []
  #runMessages: AgentMessage[] = []
  #run: Run | undefined
  #disposePromise: Promise<void> | undefined
  #state: AgentState = { status: 'idle', step: 0, messages: [], updatedAt: Date.now() }

  constructor(config: AgentConfig) {
    const { tools = [], ...runtimeConfig } = config
    if (config.maxInstructionsLength !== undefined && (!Number.isFinite(config.maxInstructionsLength) || !Number.isInteger(config.maxInstructionsLength) || config.maxInstructionsLength < 0)) {
      throw new TypeError('maxInstructionsLength must be a non-negative finite integer')
    }
    if (config.contextBudget !== undefined) {
      if (!Number.isFinite(config.contextBudget.maxTokens) || !Number.isInteger(config.contextBudget.maxTokens) || config.contextBudget.maxTokens <= 0) {
        throw new TypeError('contextBudget.maxTokens must be a positive finite integer')
      }
      if (typeof config.contextBudget.estimateTokens !== 'function') {
        throw new TypeError('contextBudget.estimateTokens must be a function')
      }
    }
    this.#config = { ...runtimeConfig, maxSteps: config.maxSteps ?? 20, timeoutMs: config.timeoutMs ?? 120_000, maxToolResultLength: config.maxToolResultLength ?? 20_000, maxInstructionsLength: config.maxInstructionsLength ?? 20_000 }
    this.#registry = new ToolRegistry(tools.map((initial) => this.#normalizeInitialTool(initial)))
    this.#commit({
      messages: this.#history,
      contextUsage: config.contextBudget ? { maxTokens: config.contextBudget.maxTokens, usedTokens: 0 } : undefined,
    })
  }
  get state(): Readonly<AgentState> { return this.#state }
  subscribe(listener: AgentStateListener): () => void {
    this.#assertUsable(); this.#listeners.add(listener); this.#notifyOne(listener)
    return () => this.#listeners.delete(listener)
  }
  registerTool(tool: Tool, options?: { scope?: string }): () => boolean { this.#assertUsable(); return this.#registry.register(tool, options?.scope) }
  unregisterTool(name: string, options?: { scope?: string }): boolean { this.#assertUsable(); return this.#registry.unregister(name, options?.scope) }
  replaceTool(tool: Tool, options?: { scope?: string }): void { this.#assertUsable(); this.#registry.replace(tool, options?.scope) }
  replaceToolScope(scope: string, tools: readonly Tool[]): void { this.#assertUsable(); this.#registry.replaceScope(scope, tools) }
  listTools(options?: { scope?: string }): readonly Readonly<RegisteredToolInfo>[] { this.#assertUsable(); return this.#registry.list(options?.scope) }
  listToolScopes(): readonly string[] { this.#assertUsable(); return this.#registry.listScopes() }
  removeToolScope(scope: string): number { this.#assertUsable(); return this.#registry.removeScope(scope) }
  clearHistory(): void {
    this.#assertUsable(); if (this.#run) throw new AgentBusyError('Cannot clear history while running')
    this.#history = []
    this.#commit({
      status: 'idle',
      runId: undefined,
      step: 0,
      messages: this.#history,
      result: undefined,
      error: undefined,
      activeTool: undefined,
      contextUsage: this.#config.contextBudget
        ? { maxTokens: this.#config.contextBudget.maxTokens, usedTokens: 0 }
        : undefined,
    })
  }
  abort(): void { if (this.#run) this.#terminate(this.#run, 'manual') }

  async send(message: string | UserMessage): Promise<AgentResult> {
    this.#assertUsable(); if (this.#run) throw new AgentBusyError('An agent run is already active')
    const user: UserMessage = typeof message === 'string' ? { role: 'user', content: message } : message
    if (!user.content.trim()) throw new TypeError('Message must not be empty')
    const runId = globalThis.crypto.randomUUID(); const controller = new AbortController()
    const run: Run = { runId, controller, termination: undefined, step: 0, timer: setTimeout(() => this.#terminate(run, 'timeout'), this.#config.timeoutMs) }
    this.#run = run; this.#runMessages = [user]
    this.#commit({ status: 'running', runId, step: 0, messages: [...this.#history, ...this.#runMessages], result: undefined, error: undefined, activeTool: undefined })
    try {
      while (run.step < this.#config.maxSteps) {
        run.step++
        const snapshot = this.#registry.snapshot()
        const tools = [...snapshot.registrations.values()].map(({ tool }) => ({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema }))
        const toolInfo = Object.freeze([...snapshot.registrations.values()].map(({ tool, scope }) => Object.freeze({ name: tool.name, description: tool.description, scope })))
        const systemMessage = await assembleSystemMessage({
          systemPrompt: this.#config.systemPrompt,
          resolveInstructions: this.#config.resolveInstructions,
          maxInstructionsLength: this.#config.maxInstructionsLength,
          context: createInstructionResolverContext(run.runId, run.step, toolInfo, run.controller.signal),
        })
        this.#ensureCurrent(run)
        let request: LLMRequest = { messages: [systemMessage, ...this.#history, ...this.#runMessages], tools }
        if (this.#config.contextBudget) {
          request = Object.freeze({
            messages: deepFreeze(structuredClone(request.messages)),
            tools: Object.freeze(request.tools.map((tool) => Object.freeze(tool))),
          })
          const budgetError = await this.#checkContextBudget(run, request)
          if (budgetError) return this.#fail(run, budgetError)
        }
        const response = await awaitWithAbort(Promise.resolve(this.#config.llm.invoke(request, { signal: run.controller.signal })), run.controller.signal)
        this.#ensureCurrent(run)
        this.#validateAssistant(response.message)
        this.#runMessages.push(response.message)
        if (!response.message.toolCalls?.length) {
          const content = response.message.content ?? ''
          this.#history.push(...this.#runMessages); this.#runMessages = []
          const result: AgentResult = { status: 'completed', runId, content, steps: run.step }
          this.#finish(run, result); return result
        }
        for (const call of response.message.toolCalls) {
          this.#ensureCurrent(run)
          const registration = snapshot.registrations.get(call.name)
          const resultMessage = registration ? await this.#executeTool(run, registration, call.callId, call.input) : this.#toolError(call.callId, call.name, 'TOOL_NOT_FOUND', `Tool not found: ${call.name}`)
          this.#runMessages.push(resultMessage)
          this.#commit({ step: run.step, messages: [...this.#history, ...this.#runMessages], activeTool: undefined })
        }
      }
      const error: AgentError = { code: 'MAX_STEPS_EXCEEDED', message: `Maximum steps exceeded: ${this.#config.maxSteps}`, retryable: false }
      return this.#fail(run, error)
    } catch (error) {
      if (run.controller.signal.aborted) {
        if (run.termination === 'timeout') return this.#fail(run, { code: 'TIMEOUT', message: `Run timed out after ${this.#config.timeoutMs}ms`, retryable: false })
        const result: AgentResult = { status: 'aborted', runId, steps: run.step }
        this.#finish(run, result); return result
      }
      if (error instanceof PromptAssemblyError) return this.#fail(run, { code: error.code, message: error.message, retryable: false })
      if (error instanceof ContextEstimationError) {
        return this.#fail(run, { code: 'CONTEXT_ESTIMATION_ERROR', message: 'Context token estimation failed', retryable: false })
      }
      if (error instanceof ModelError) {
        return this.#fail(run, {
          code: error.code,
          message: error.message,
          retryable: error.retryable,
          ...(error.statusCode === undefined ? {} : { statusCode: error.statusCode }),
        })
      }
      return this.#fail(run, { code: 'MODEL_ERROR', message: 'Model invocation failed', retryable: false })
    }
  }

  dispose(): Promise<void> {
    if (this.#disposePromise) return this.#disposePromise
    this.#disposePromise = (async () => {
      if (this.#run) this.#terminate(this.#run, 'dispose')
      await Promise.resolve()
      this.#history = []; this.#runMessages = []; this.#registry.clear()
      this.#commit({ status: 'disposed', runId: undefined, step: 0, messages: [], activeTool: undefined, result: undefined, error: undefined })
      this.#listeners.clear()
    })()
    return this.#disposePromise
  }

  async #checkContextBudget(run: Run, request: LLMRequest): Promise<AgentError | undefined> {
    const budget = this.#config.contextBudget
    if (!budget) return undefined
    let usedTokens: unknown
    try {
      const context = Object.freeze({
        runId: run.runId,
        step: run.step,
        signal: run.controller.signal,
      }) satisfies ContextEstimationContext
      usedTokens = await awaitWithAbort(
        Promise.resolve().then(() => budget.estimateTokens(request, context)),
        run.controller.signal,
      )
    } catch (error) {
      if (run.controller.signal.aborted) throw error
      throw new ContextEstimationError('Context token estimation failed')
    }
    this.#ensureCurrent(run)
    if (!Number.isFinite(usedTokens) || !Number.isInteger(usedTokens) || (usedTokens as number) < 0) {
      throw new ContextEstimationError('Context token estimator must return a non-negative finite integer')
    }
    const tokens = usedTokens as number
    this.#commit({ contextUsage: { maxTokens: budget.maxTokens, usedTokens: tokens } })
    if (tokens <= budget.maxTokens) return undefined
    return {
      code: 'CONTEXT_LIMIT_EXCEEDED',
      message: `Context usage ${tokens} exceeds the maximum of ${budget.maxTokens} tokens`,
      retryable: false,
    }
  }

  async #executeTool(run: Run, registration: ToolRegistration, callId: string, input: unknown): Promise<ToolResultMessage> {
    if (!this.#registry.isCurrent(registration)) return this.#toolError(callId, registration.tool.name, 'TOOL_CHANGED', 'Tool changed before execution')
    const parsed = registration.tool.inputSchema.safeParse(input)
    if (!parsed.success) return this.#toolError(callId, registration.tool.name, 'TOOL_INVALID_INPUT', parsed.error.message)
    this.#commit({ activeTool: { name: registration.tool.name, input }, step: run.step, messages: [...this.#history, ...this.#runMessages] })
    try {
      const output = await awaitWithAbort(Promise.resolve(registration.tool.execute(parsed.data, { signal: run.controller.signal, runId: run.runId, step: run.step })), run.controller.signal)
      this.#ensureCurrent(run)
      let content = serializeToolOutput(output)
      if (content.length > this.#config.maxToolResultLength) content = `${content.slice(0, this.#config.maxToolResultLength)}\n[truncated]`
      return { role: 'tool', callId, name: registration.tool.name, content, isError: false }
    } catch (error) {
      if (run.controller.signal.aborted) throw error
      return this.#toolError(callId, registration.tool.name, 'TOOL_EXECUTION_ERROR', errorMessage(error))
    }
  }
  #toolError(callId: string, name: string, code: string, message: string): ToolResultMessage { return { role: 'tool', callId, name, content: JSON.stringify({ error: { code, message } }), isError: true } }
  #validateAssistant(message: AssistantMessage): void { if (!message.content && !message.toolCalls?.length) throw new Error('Assistant message must contain content or tool calls') }
  #terminate(run: Run, reason: Run['termination']): void { if (run.termination) return; run.termination = reason; run.controller.abort() }
  #ensureCurrent(run: Run): void { if (this.#run?.runId !== run.runId || run.controller.signal.aborted) throw new DOMException('The operation was aborted', 'AbortError') }
  #fail(run: Run, error: AgentError): AgentResult { const result: AgentResult = { status: 'error', runId: run.runId, error, steps: run.step }; this.#finish(run, result); return result }
  #finish(run: Run, result: AgentResult): void {
    clearTimeout(run.timer); if (this.#run?.runId === run.runId) this.#run = undefined
    this.#runMessages = []
    if (run.termination === 'dispose') return
    this.#commit({ status: result.status, runId: run.runId, step: run.step, messages: this.#history, activeTool: undefined, result, error: result.status === 'error' ? result.error : undefined })
  }
  #commit(patch: Partial<AgentState>): void { this.#state = structuredClone({ ...this.#state, ...patch, updatedAt: Date.now() }); for (const listener of this.#listeners) this.#notifyOne(listener) }
  #notifyOne(listener: AgentStateListener): void { try { listener(this.#state) } catch { /* Subscribers are isolated. */ } }
  #normalizeInitialTool(initial: InitialTool): { tool: Tool; scope?: string } {
    return 'tool' in initial ? { tool: initial.tool, scope: initial.scope } : { tool: initial }
  }
  #assertUsable(): void { if (this.#state.status === 'disposed' || this.#disposePromise) throw new AgentDisposedError('Agent has been disposed') }
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value) || seen.has(value)) return value
  seen.add(value)
  const object = value as Record<PropertyKey, unknown>
  for (const key of Reflect.ownKeys(object)) deepFreeze(object[key], seen)
  try { return Object.freeze(value) } catch { return value }
}
