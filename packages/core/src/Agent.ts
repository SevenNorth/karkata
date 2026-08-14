import { awaitWithAbort } from './abort.js'
import { AgentBusyError, AgentDisposedError, errorMessage, ModelError, ToolRegistrationError } from './errors.js'
import { createHumanInputRequest, HUMAN_INPUT_TOOL, HUMAN_INPUT_TOOL_NAME, parseHumanInput, validateHumanInputConfig } from './humanInput.js'
import { validateCommittedHistory } from './history.js'
import { assembleSystemMessage, createInstructionResolverContext, PromptAssemblyError } from './prompt.js'
import { ToolRegistry, type ToolRegistration } from './ToolRegistry.js'
import { serializeToolOutput } from './toolOutput.js'
import type { AgentConfig, AgentError, AgentMessage, AgentRequest, AgentRequestListener, AgentResult, AgentState, AgentStateListener, AssistantMessage, ContextCompactionContext, ContextEstimationContext, InitialTool, LLMRequest, RegisteredToolInfo, Tool, ToolResultMessage, UserMessage } from './types.js'

interface Run { runId: string; controller: AbortController; termination: 'manual' | 'timeout' | 'dispose' | undefined; timer: ReturnType<typeof setTimeout>; step: number }
interface PendingHumanInput {
  readonly request: AgentRequest
  readonly runId: string
  readonly resolve: (answer: string) => void
}

class ContextEstimationError extends Error {
  override readonly name = 'ContextEstimationError'
}

class ContextCompactionError extends Error {
  override readonly name = 'ContextCompactionError'
}

export class Agent {
  readonly #config: Required<Pick<AgentConfig, 'maxSteps' | 'timeoutMs' | 'maxToolResultLength' | 'maxInstructionsLength'>> & AgentConfig
  readonly #registry: ToolRegistry
  readonly #listeners = new Set<AgentStateListener>()
  readonly #requestListeners = new Set<AgentRequestListener>()
  #history: AgentMessage[] = []
  #runMessages: AgentMessage[] = []
  #run: Run | undefined
  #pendingHumanInput: PendingHumanInput | undefined
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
      const compaction = config.contextBudget.compaction
      if (compaction !== undefined) {
        if (compaction === null || typeof compaction !== 'object' || Array.isArray(compaction)) {
          throw new TypeError('contextBudget.compaction must be a configuration object')
        }
        if (!isPositiveInteger(compaction.triggerTokens)) throw new TypeError('contextBudget.compaction.triggerTokens must be a positive finite integer')
        if (compaction.triggerTokens > config.contextBudget.maxTokens) throw new TypeError('contextBudget.compaction.triggerTokens must not exceed maxTokens')
        if (!isPositiveInteger(compaction.targetTokens)) throw new TypeError('contextBudget.compaction.targetTokens must be a positive finite integer')
        if (compaction.targetTokens >= compaction.triggerTokens) throw new TypeError('contextBudget.compaction.targetTokens must be less than triggerTokens')
        if (typeof compaction.compactHistory !== 'function') throw new TypeError('contextBudget.compaction.compactHistory must be a function')
      }
    }
    validateHumanInputConfig(config.humanInput)
    if (config.humanInput !== undefined) this.#assertNoReservedTool(tools.map((initial) => this.#normalizeInitialTool(initial).tool), true)
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
  subscribeRequests(listener: AgentRequestListener): () => void {
    this.#assertUsable(); this.#requestListeners.add(listener)
    if (this.#pendingHumanInput) this.#notifyRequestListener(listener, this.#pendingHumanInput.request)
    return () => this.#requestListeners.delete(listener)
  }
  respond(requestId: string, answer: string): boolean {
    if (typeof answer !== 'string' || !answer.trim()) throw new TypeError('Human input answer must not be empty')
    const pending = this.#pendingHumanInput
    if (!pending || pending.request.id !== requestId || this.#run?.runId !== pending.runId || this.#run.controller.signal.aborted) return false
    this.#pendingHumanInput = undefined
    this.#commit({ status: 'running' })
    pending.resolve(answer)
    return true
  }
  registerTool(tool: Tool, options?: { scope?: string }): () => boolean { this.#assertUsable(); this.#assertNoReservedTool([tool]); return this.#registry.register(tool, options?.scope) }
  unregisterTool(name: string, options?: { scope?: string }): boolean { this.#assertUsable(); return this.#registry.unregister(name, options?.scope) }
  replaceTool(tool: Tool, options?: { scope?: string }): void { this.#assertUsable(); this.#assertNoReservedTool([tool]); this.#registry.replace(tool, options?.scope) }
  replaceToolScope(scope: string, tools: readonly Tool[]): void { this.#assertUsable(); this.#assertNoReservedTool(tools); this.#registry.replaceScope(scope, tools) }
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
    let effectiveHistory = this.#history
    this.#commit({ status: 'running', runId, step: 0, messages: [...this.#history, ...this.#runMessages], result: undefined, error: undefined, activeTool: undefined })
    try {
      while (run.step < this.#config.maxSteps) {
        run.step++
        const snapshot = this.#registry.snapshot()
        const tools = [...snapshot.registrations.values()].map(({ tool }) => ({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema }))
        if (this.#config.humanInput !== undefined) tools.push(HUMAN_INPUT_TOOL)
        const toolInfo = Object.freeze([...snapshot.registrations.values()].map(({ tool, scope }) => Object.freeze({ name: tool.name, description: tool.description, scope })))
        const systemMessage = await assembleSystemMessage({
          systemPrompt: this.#config.systemPrompt,
          resolveInstructions: this.#config.resolveInstructions,
          maxInstructionsLength: this.#config.maxInstructionsLength,
          context: createInstructionResolverContext(run.runId, run.step, toolInfo, run.controller.signal),
        })
        this.#ensureCurrent(run)
        let request: LLMRequest = { messages: [systemMessage, ...effectiveHistory, ...this.#runMessages], tools }
        if (this.#config.contextBudget) {
          request = freezeRequest(request)
          let usedTokens = await this.#estimateContextTokens(run, request)
          const compaction = this.#config.contextBudget.compaction
          if (compaction && usedTokens > compaction.triggerTokens && effectiveHistory.length > 0) {
            effectiveHistory = await this.#compactHistory(run, effectiveHistory, usedTokens)
            request = freezeRequest({ messages: [systemMessage, ...effectiveHistory, ...this.#runMessages], tools })
            usedTokens = await this.#estimateContextTokens(run, request)
            if (usedTokens > compaction.targetTokens) {
              return this.#fail(run, { code: 'CONTEXT_COMPACTION_ERROR', message: 'Context compaction failed', retryable: false })
            }
          }
          if (usedTokens > this.#config.contextBudget.maxTokens) {
            return this.#fail(run, {
              code: 'CONTEXT_LIMIT_EXCEEDED',
              message: `Context usage ${usedTokens} exceeds the maximum of ${this.#config.contextBudget.maxTokens} tokens`,
              retryable: false,
            })
          }
        }
        const response = await awaitWithAbort(Promise.resolve(this.#config.llm.invoke(request, { signal: run.controller.signal })), run.controller.signal)
        this.#ensureCurrent(run)
        this.#validateAssistant(response.message)
        this.#runMessages.push(response.message)
        if (!response.message.toolCalls?.length) {
          const content = response.message.content ?? ''
          this.#history = [...effectiveHistory, ...this.#runMessages]; this.#runMessages = []
          const result: AgentResult = { status: 'completed', runId, content, steps: run.step }
          this.#finish(run, result); return result
        }
        for (const call of response.message.toolCalls) {
          this.#ensureCurrent(run)
          const registration = snapshot.registrations.get(call.name)
          const resultMessage = call.name === HUMAN_INPUT_TOOL_NAME && this.#config.humanInput !== undefined
            ? await this.#requestHumanInput(run, call.callId, call.input)
            : registration
              ? await this.#executeTool(run, registration, call.callId, call.input)
              : this.#toolError(call.callId, call.name, 'TOOL_NOT_FOUND', `Tool not found: ${call.name}`)
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
      if (error instanceof ContextCompactionError) {
        return this.#fail(run, { code: 'CONTEXT_COMPACTION_ERROR', message: 'Context compaction failed', retryable: false })
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
      this.#history = []; this.#runMessages = []; this.#pendingHumanInput = undefined; this.#registry.clear()
      this.#commit({ status: 'disposed', runId: undefined, step: 0, messages: [], activeTool: undefined, result: undefined, error: undefined })
      this.#listeners.clear()
      this.#requestListeners.clear()
    })()
    return this.#disposePromise
  }

  async #estimateContextTokens(run: Run, request: LLMRequest): Promise<number> {
    const budget = this.#config.contextBudget
    if (!budget) return 0
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
    return tokens
  }

  async #compactHistory(run: Run, history: readonly AgentMessage[], usedTokens: number): Promise<AgentMessage[]> {
    const budget = this.#config.contextBudget
    const compaction = budget?.compaction
    if (!budget || !compaction) return [...history]
    try {
      const context = Object.freeze({
        runId: run.runId,
        step: run.step,
        signal: run.controller.signal,
        usedTokens,
        targetTokens: compaction.targetTokens,
        maxTokens: budget.maxTokens,
      }) satisfies ContextCompactionContext
      const frozenHistory = deepFreeze(structuredClone(history))
      const result = await awaitWithAbort(
        Promise.resolve().then(() => compaction.compactHistory(frozenHistory, context)),
        run.controller.signal,
      )
      this.#ensureCurrent(run)
      const candidate: unknown = structuredClone(result)
      validateCommittedHistory(candidate)
      return [...candidate]
    } catch (error) {
      if (run.controller.signal.aborted) throw error
      throw new ContextCompactionError('Context compaction failed')
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
      return { role: 'tool', callId, name: registration.tool.name, content: this.#serializeToolResult(output), isError: false }
    } catch (error) {
      if (run.controller.signal.aborted) throw error
      return this.#toolError(callId, registration.tool.name, 'TOOL_EXECUTION_ERROR', errorMessage(error))
    }
  }
  async #requestHumanInput(run: Run, callId: string, input: unknown): Promise<ToolResultMessage> {
    const parsed = parseHumanInput(input)
    if (!parsed.success) return this.#toolError(callId, HUMAN_INPUT_TOOL_NAME, 'TOOL_INVALID_INPUT', parsed.error.message)
    const request = createHumanInputRequest(run.runId, run.step, parsed.data.question)
    const answer = await awaitWithAbort(new Promise<string>((resolve) => {
      this.#pendingHumanInput = { request, runId: run.runId, resolve }
      this.#commit({ status: 'waiting_for_input', step: run.step, messages: [...this.#history, ...this.#runMessages], activeTool: undefined })
      for (const listener of this.#requestListeners) this.#notifyRequestListener(listener, request)
    }), run.controller.signal)
    this.#ensureCurrent(run)
    return { role: 'tool', callId, name: HUMAN_INPUT_TOOL_NAME, content: this.#serializeToolResult({ answer }), isError: false }
  }
  #toolError(callId: string, name: string, code: string, message: string): ToolResultMessage { return { role: 'tool', callId, name, content: JSON.stringify({ error: { code, message } }), isError: true } }
  #validateAssistant(message: AssistantMessage): void { if (!message.content && !message.toolCalls?.length) throw new Error('Assistant message must contain content or tool calls') }
  #terminate(run: Run, reason: Run['termination']): void { if (run.termination) return; run.termination = reason; run.controller.abort() }
  #ensureCurrent(run: Run): void { if (this.#run?.runId !== run.runId || run.controller.signal.aborted) throw new DOMException('The operation was aborted', 'AbortError') }
  #fail(run: Run, error: AgentError): AgentResult { const result: AgentResult = { status: 'error', runId: run.runId, error, steps: run.step }; this.#finish(run, result); return result }
  #finish(run: Run, result: AgentResult): void {
    clearTimeout(run.timer); if (this.#run?.runId === run.runId) this.#run = undefined
    this.#runMessages = []; if (this.#pendingHumanInput?.runId === run.runId) this.#pendingHumanInput = undefined
    if (run.termination === 'dispose') return
    this.#commit({ status: result.status, runId: run.runId, step: run.step, messages: this.#history, activeTool: undefined, result, error: result.status === 'error' ? result.error : undefined })
  }
  #commit(patch: Partial<AgentState>): void { this.#state = structuredClone({ ...this.#state, ...patch, updatedAt: Date.now() }); for (const listener of this.#listeners) this.#notifyOne(listener) }
  #notifyOne(listener: AgentStateListener): void { try { listener(this.#state) } catch { /* Subscribers are isolated. */ } }
  #notifyRequestListener(listener: AgentRequestListener, request: AgentRequest): void { try { listener(request) } catch { /* Subscribers are isolated. */ } }
  #serializeToolResult(output: unknown): string {
    const content = serializeToolOutput(output)
    return content.length > this.#config.maxToolResultLength
      ? `${content.slice(0, this.#config.maxToolResultLength)}\n[truncated]`
      : content
  }
  #normalizeInitialTool(initial: InitialTool): { tool: Tool; scope?: string } {
    return 'tool' in initial ? { tool: initial.tool, scope: initial.scope } : { tool: initial }
  }
  #assertNoReservedTool(tools: readonly Tool[], enabled = this.#config.humanInput !== undefined): void {
    if (!enabled) return
    if (tools.some((tool) => tool.name === HUMAN_INPUT_TOOL_NAME)) {
      throw new ToolRegistrationError(`Tool name is reserved while human input is enabled: ${HUMAN_INPUT_TOOL_NAME}`)
    }
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

function freezeRequest(request: LLMRequest): LLMRequest {
  return Object.freeze({
    messages: deepFreeze(structuredClone(request.messages)),
    tools: Object.freeze(request.tools.map((tool) => Object.freeze(tool))),
  })
}

function isPositiveInteger(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value > 0
}
