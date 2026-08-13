import { awaitWithAbort } from './abort.js'
import { AgentBusyError, AgentDisposedError, errorMessage } from './errors.js'
import { assembleSystemMessage, createInstructionResolverContext, PromptAssemblyError } from './prompt.js'
import { ToolRegistry, type ToolRegistration } from './ToolRegistry.js'
import { serializeToolOutput } from './toolOutput.js'
import type { AgentConfig, AgentError, AgentMessage, AgentResult, AgentState, AgentStateListener, AssistantMessage, InitialTool, RegisteredToolInfo, Tool, ToolResultMessage, UserMessage } from './types.js'

interface Run { runId: string; controller: AbortController; termination: 'manual' | 'timeout' | 'dispose' | undefined; timer: ReturnType<typeof setTimeout>; step: number }

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
    this.#config = { ...runtimeConfig, maxSteps: config.maxSteps ?? 20, timeoutMs: config.timeoutMs ?? 120_000, maxToolResultLength: config.maxToolResultLength ?? 20_000, maxInstructionsLength: config.maxInstructionsLength ?? 20_000 }
    this.#registry = new ToolRegistry(tools.map((initial) => this.#normalizeInitialTool(initial)))
    this.#commit({ messages: this.#history })
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
    this.#commit({ status: 'idle', runId: undefined, step: 0, messages: this.#history, result: undefined, error: undefined, activeTool: undefined })
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
        const response = await awaitWithAbort(Promise.resolve(this.#config.llm.invoke({ messages: [systemMessage, ...this.#history, ...this.#runMessages], tools }, { signal: run.controller.signal })), run.controller.signal)
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
      const error: AgentError = { code: 'MAX_STEPS_EXCEEDED', message: `Maximum steps exceeded: ${this.#config.maxSteps}` }
      return this.#fail(run, error)
    } catch (error) {
      if (run.controller.signal.aborted) {
        if (run.termination === 'timeout') return this.#fail(run, { code: 'TIMEOUT', message: `Run timed out after ${this.#config.timeoutMs}ms` })
        const result: AgentResult = { status: 'aborted', runId, steps: run.step }
        this.#finish(run, result); return result
      }
      if (error instanceof PromptAssemblyError) return this.#fail(run, { code: error.code, message: error.message, cause: error.cause })
      return this.#fail(run, { code: 'MODEL_ERROR', message: errorMessage(error), cause: error })
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
