import type { AgentMessage, AgentRequest, AgentState, AssistantMessage, ToolResultMessage } from '@karkata-ai/core'
import type {
  AgentUIAdapter,
  AgentUIItem,
  AgentUIRunStatus,
  AgentUIState,
  AgentUIStore as AgentUIStoreContract,
  AgentUISubmitResult,
} from './types.js'

const EMPTY_COMPOSER = Object.freeze({ mode: 'message' as const })
const HUMAN_INPUT_TOOL_NAME = 'ask_user'

interface ObservedRun {
  readonly runId: string
  readonly baseLength: number
  processedMessages: number
}

interface StreamingItem {
  readonly runId: string
  readonly step: number
  readonly itemId: string
}

export class AgentUIStore implements AgentUIStoreContract {
  readonly #agent: AgentUIAdapter
  readonly #listeners = new Set<() => void>()
  #unsubscribeState: () => void = () => {}
  #unsubscribeRequests: () => void = () => {}
  #agentState: AgentState | undefined
  #request: AgentRequest | undefined
  #items: AgentUIItem[] = []
  #historyCompleteness: AgentUIState['historyCompleteness'] = 'session'
  #observedRun: ObservedRun | undefined
  #streamingItem: StreamingItem | undefined
  #nextItemId = 1
  #snapshot!: Readonly<AgentUIState>
  #initializing = true
  #disposed = false

  constructor(agent: AgentUIAdapter) {
    this.#agent = agent
    try {
      this.#unsubscribeState = agent.subscribe((state) => { this.#receiveState(state) })
      this.#unsubscribeRequests = agent.subscribeRequests((request) => { this.#receiveRequest(request) })
      this.#initializing = false
      if (!this.#agentState) throw new TypeError('AgentUIAdapter.subscribe() must synchronously replay the current state')
      this.#initializeTranscript(this.#agentState)
      this.#initializeObservedRun(this.#agentState)
      if (this.#request && this.#agentState.status === 'waiting_for_input') this.#addHumanQuestion(this.#request)
      this.#snapshot = this.#createSnapshot(0)
    } catch (error) {
      this.#unsubscribeState()
      this.#unsubscribeRequests()
      throw error
    }
  }

  getSnapshot(): Readonly<AgentUIState> {
    return this.#snapshot
  }

  subscribe(listener: () => void): () => void {
    if (this.#disposed) throw new Error('AgentUIStore has been disposed')
    if (typeof listener !== 'function') throw new TypeError('AgentUIStore listener must be a function')
    this.#listeners.add(listener)
    return () => { this.#listeners.delete(listener) }
  }

  async submit(input: string): Promise<AgentUISubmitResult> {
    if (this.#disposed) throw new Error('AgentUIStore has been disposed')
    if (typeof input !== 'string' || !input.trim()) throw new TypeError('Agent UI input must not be empty')
    const snapshot = this.#snapshot
    if (snapshot.composer.mode === 'response') {
      if (snapshot.status !== 'waiting_for_input') throw new Error('Agent is not waiting for input')
      const question = this.#findQuestion(snapshot.composer.requestId)
      const accepted = this.#agent.respond(snapshot.composer.requestId, input)
      if (accepted && question) {
        this.#markQuestion(question.requestId, 'answered')
        this.#addHumanAnswer(question, input)
        this.#publish()
      }
      return { type: 'response', accepted }
    }
    if (!['idle', 'completed', 'error', 'aborted'].includes(snapshot.status)) throw new Error('Agent cannot accept a new message')
    return { type: 'message', result: await this.#agent.send(input) }
  }

  abort(): void {
    if (!this.#disposed) this.#agent.abort()
  }

  dispose(): void {
    if (this.#disposed) return
    this.#disposed = true
    this.#unsubscribeState()
    this.#unsubscribeRequests()
    this.#listeners.clear()
  }

  #receiveState(state: Readonly<AgentState>): void {
    if (this.#disposed) return
    const next = structuredClone(state)
    if (this.#initializing) {
      this.#agentState = next
      return
    }
    this.#applyState(next)
    this.#agentState = next
    this.#publish()
  }

  #receiveRequest(request: Readonly<AgentRequest>): void {
    if (this.#disposed) return
    if (!this.#agentState || this.#agentState.status !== 'waiting_for_input'
      || this.#agentState.runId !== request.runId
      || !containsHumanInputCall(this.#agentState.messages, request.callId)) return
    this.#request = structuredClone(request)
    if (!this.#initializing) {
      this.#addHumanQuestion(this.#request)
      this.#publish()
    }
  }

  #publish(): void {
    this.#snapshot = this.#createSnapshot(this.#snapshot.revision + 1)
    for (const listener of this.#listeners) {
      try { listener() } catch { /* Store subscribers are isolated. */ }
    }
  }

  #createSnapshot(revision: number): Readonly<AgentUIState> {
    const state = this.#agentState
    if (!state) throw new TypeError('Agent state is unavailable')
    const composer = state.status === 'waiting_for_input' && this.#request
      ? {
          mode: 'response' as const,
          requestId: this.#request.id,
          callId: this.#request.callId,
          prompt: this.#request.prompt,
        }
      : EMPTY_COMPOSER
    return deepFreeze({
      items: structuredClone(this.#items),
      composer,
      historyCompleteness: this.#historyCompleteness,
      status: state.status,
      ...(state.runId === undefined ? {} : { runId: state.runId }),
      ...(state.activeTool === undefined ? {} : { activeToolName: state.activeTool.name }),
      ...(state.result === undefined ? {} : { result: structuredClone(state.result) }),
      ...(state.error === undefined ? {} : { error: structuredClone(state.error) }),
      ...(state.contextUsage === undefined ? {} : { contextUsage: structuredClone(state.contextUsage) }),
      revision,
    })
  }

  #initializeTranscript(state: AgentState): void {
    if (state.messages.length === 0) return
    this.#historyCompleteness = 'context_only'
    this.#projectContext(state.messages)
  }

  #initializeObservedRun(state: AgentState): void {
    if ((state.status !== 'running' && state.status !== 'waiting_for_input') || !state.runId) return
    this.#observedRun = {
      runId: state.runId,
      baseLength: state.messages.length,
      processedMessages: 0,
    }
    this.#applyPartialResponse(state)
  }

  #applyState(state: AgentState): void {
    const previous = this.#agentState
    if (state.status === 'idle' && state.runId === undefined && state.messages.length === 0) {
      this.#items = []
      this.#historyCompleteness = 'session'
      this.#observedRun = undefined
      this.#streamingItem = undefined
      this.#request = undefined
      return
    }

    if (state.status !== 'waiting_for_input' && previous?.status === 'waiting_for_input') {
      if (this.#request) this.#markQuestion(
        this.#request.id,
        state.status === 'running' ? 'answered' : 'cancelled',
      )
      this.#request = undefined
    }

    if (state.status === 'disposed' && this.#observedRun) {
      this.#markStreamingIncomplete(this.#observedRun.runId)
      this.#setRunStatus(this.#observedRun.runId, 'aborted')
      this.#observedRun = undefined
      return
    }

    if ((state.status === 'running' || state.status === 'waiting_for_input') && state.runId) {
      if (this.#observedRun?.runId !== state.runId && previous?.runId !== state.runId) {
        this.#markStreamingIncomplete()
        this.#observedRun = {
          runId: state.runId,
          baseLength: Math.max(0, state.messages.length - 1),
          processedMessages: 0,
        }
      }
      this.#processObservedRunMessages(state)
      this.#applyPartialResponse(state)
      return
    }

    if (!state.runId || this.#observedRun?.runId !== state.runId) return
    if (state.result?.status === 'completed') {
      if (!this.#completeStreaming(state.runId, state.result.content)) {
        this.#addMessage('assistant', 'conversation', state.result.content, state.runId, 'active')
      }
      this.#setRunStatus(state.runId, 'completed')
    } else if (state.status === 'error') {
      this.#markStreamingIncomplete(state.runId)
      this.#setRunStatus(state.runId, 'error')
    } else if (state.status === 'aborted' || state.status === 'disposed') {
      this.#markStreamingIncomplete(state.runId)
      this.#setRunStatus(state.runId, 'aborted')
    }
    this.#observedRun = undefined
  }

  #processObservedRunMessages(state: AgentState): void {
    const run = this.#observedRun
    if (!run || run.runId !== state.runId) return
    const messages = state.messages.slice(run.baseLength)
    for (const message of messages.slice(run.processedMessages)) this.#projectObservedMessage(message, run.runId)
    run.processedMessages = messages.length
  }

  #projectObservedMessage(message: AgentMessage, runId: string): void {
    if (message.role === 'user') {
      this.#addMessage('user', 'conversation', message.content, runId, 'active')
      return
    }
    if (message.role === 'assistant') {
      if (message.content && !this.#completeStreaming(runId, message.content)) {
        this.#addMessage('assistant', 'conversation', message.content, runId, 'active')
      }
      this.#addToolCalls(message, runId, 'active')
      return
    }
    if (message.role === 'tool') this.#applyToolResult(message, runId, 'active')
  }

  #projectContext(messages: readonly AgentMessage[]): void {
    for (const message of messages) {
      if (message.role === 'user') {
        this.#addMessage('user', 'context_snapshot', message.content, undefined, 'unknown')
      } else if (message.role === 'assistant') {
        if (message.content) this.#addMessage('assistant', 'context_snapshot', message.content, undefined, 'unknown')
        this.#addToolCalls(message, undefined, 'unknown')
      } else if (message.role === 'tool') {
        this.#applyToolResult(message, undefined, 'unknown')
      }
    }
  }

  #addMessage(
    role: 'user' | 'assistant',
    source: 'conversation' | 'context_snapshot',
    content: string,
    runId: string | undefined,
    runStatus: AgentUIRunStatus,
  ): string {
    const id = this.#newId()
    this.#items.push({
      type: 'message',
      id,
      ...(runId === undefined ? {} : { runId }),
      runStatus,
      role,
      source,
      contentStatus: 'complete',
      content,
    })
    return id
  }

  #applyPartialResponse(state: AgentState): void {
    const partial = state.partialResponse
    if ((state.status !== 'running' && state.status !== 'waiting_for_input')
      || !state.runId || !partial || partial.runId !== state.runId || partial.step !== state.step
      || !Number.isInteger(partial.step) || partial.step < 0 || !partial.content) return
    if (this.#streamingItem?.runId === partial.runId && this.#streamingItem.step === partial.step) {
      const index = this.#findItemIndex(this.#streamingItem.itemId)
      const item = this.#items[index]
      if (item?.type === 'message') {
        if (!partial.content.startsWith(item.content)) return
        this.#items[index] = { ...item, content: partial.content, contentStatus: 'streaming' }
        return
      }
      this.#streamingItem = undefined
    }
    this.#markStreamingIncomplete()
    const itemId = this.#newId()
    this.#items.push({
      type: 'message', id: itemId, runId: partial.runId, runStatus: 'active',
      role: 'assistant', source: 'conversation', contentStatus: 'streaming', content: partial.content,
    })
    this.#streamingItem = { runId: partial.runId, step: partial.step, itemId }
  }

  #completeStreaming(runId: string, content: string): boolean {
    const streaming = this.#streamingItem
    if (!streaming || streaming.runId !== runId) return false
    const index = this.#findItemIndex(streaming.itemId)
    const item = this.#items[index]
    this.#streamingItem = undefined
    if (item?.type !== 'message') return false
    if (!content.startsWith(item.content)) {
      this.#items[index] = { ...item, contentStatus: 'incomplete' }
      return false
    }
    this.#items[index] = { ...item, content, contentStatus: 'complete' }
    return true
  }

  #markStreamingIncomplete(runId?: string): void {
    const streaming = this.#streamingItem
    if (!streaming || (runId !== undefined && streaming.runId !== runId)) return
    const index = this.#findItemIndex(streaming.itemId)
    const item = this.#items[index]
    if (item?.type === 'message') this.#items[index] = { ...item, contentStatus: 'incomplete' }
    this.#streamingItem = undefined
  }

  #findItemIndex(itemId: string): number {
    return this.#items.findIndex((item) => item.id === itemId)
  }

  #addToolCalls(message: AssistantMessage, runId: string | undefined, runStatus: AgentUIRunStatus): void {
    for (const call of message.toolCalls ?? []) {
      if (call.name === HUMAN_INPUT_TOOL_NAME) {
        if (runStatus === 'unknown') {
          const question = readQuestion(call.input)
          if (question) this.#addMessage('assistant', 'context_snapshot', question, undefined, 'unknown')
        }
        continue
      }
      this.#items.push({
        type: 'tool',
        id: this.#newId(),
        ...(runId === undefined ? {} : { runId }),
        runStatus,
        callId: call.callId,
        name: call.name,
        status: 'pending',
      })
    }
  }

  #applyToolResult(message: ToolResultMessage, runId: string | undefined, runStatus: AgentUIRunStatus): void {
    if (message.name === HUMAN_INPUT_TOOL_NAME) {
      if (runStatus === 'unknown' && !message.isError) {
        const answer = readAnswer(message.content)
        if (answer) this.#addMessage('user', 'context_snapshot', answer, undefined, 'unknown')
      } else if (!message.isError) {
        const question = this.#findQuestionByCallId(message.callId)
        if (question) {
          this.#markQuestion(question.requestId, 'answered')
          const answer = readAnswer(message.content)
          if (answer && !this.#hasHumanAnswer(message.callId)) this.#addHumanAnswer(question, answer)
        }
      } else if (message.isError) {
        this.#addOrUpdateTool(message, runId, runStatus)
      }
      return
    }
    this.#addOrUpdateTool(message, runId, runStatus)
  }

  #addOrUpdateTool(message: ToolResultMessage, runId: string | undefined, runStatus: AgentUIRunStatus): void {
    const index = this.#items.findIndex((item) => item.type === 'tool' && item.callId === message.callId)
    const status = message.isError ? 'error' as const : 'completed' as const
    if (index >= 0) {
      const item = this.#items[index]
      if (item?.type === 'tool') this.#items[index] = { ...item, status }
      return
    }
    this.#items.push({
      type: 'tool', id: this.#newId(), ...(runId === undefined ? {} : { runId }),
      runStatus, callId: message.callId, name: message.name, status,
    })
  }

  #setRunStatus(runId: string, runStatus: Exclude<AgentUIRunStatus, 'unknown' | 'active'>): void {
    this.#items = this.#items.map((item) => item.runId === runId ? { ...item, runStatus } : item)
  }

  #addHumanQuestion(request: AgentRequest): void {
    if (this.#findQuestion(request.id)) return
    let duplicateContextIndex = -1
    for (let index = this.#items.length - 1; index >= 0; index--) {
      const item = this.#items[index]
      if (item?.type === 'message' && item.source === 'context_snapshot'
        && item.role === 'assistant' && item.content === request.prompt) {
        duplicateContextIndex = index
        break
      }
    }
    if (duplicateContextIndex >= 0) this.#items.splice(duplicateContextIndex, 1)
    this.#items.push({
      type: 'message', id: this.#newId(), runId: request.runId, runStatus: 'active',
      role: 'assistant', source: 'human_input', interaction: 'question',
      requestId: request.id, callId: request.callId, requestStatus: 'pending',
      contentStatus: 'complete', content: request.prompt,
    })
  }

  #addHumanAnswer(
    question: Extract<AgentUIItem, { source: 'human_input'; interaction: 'question' }>,
    content: string,
  ): void {
    if (this.#hasHumanAnswer(question.callId)) return
    this.#items.push({
      type: 'message', id: this.#newId(), runId: question.runId, runStatus: 'active',
      role: 'user', source: 'human_input', interaction: 'answer',
      requestId: question.requestId, callId: question.callId, contentStatus: 'complete', content,
    })
  }

  #markQuestion(requestId: string, requestStatus: 'answered' | 'cancelled'): void {
    this.#items = this.#items.map((item) => (
      item.type === 'message' && item.source === 'human_input'
      && item.interaction === 'question' && item.requestId === requestId
        ? { ...item, requestStatus }
        : item
    ))
  }

  #findQuestion(requestId: string): Extract<AgentUIItem, { source: 'human_input'; interaction: 'question' }> | undefined {
    return this.#items.find((item): item is Extract<AgentUIItem, { source: 'human_input'; interaction: 'question' }> => (
      item.type === 'message' && item.source === 'human_input'
      && item.interaction === 'question' && item.requestId === requestId
    ))
  }

  #findQuestionByCallId(callId: string): Extract<AgentUIItem, { source: 'human_input'; interaction: 'question' }> | undefined {
    return this.#items.find((item): item is Extract<AgentUIItem, { source: 'human_input'; interaction: 'question' }> => (
      item.type === 'message' && item.source === 'human_input'
      && item.interaction === 'question' && item.callId === callId
    ))
  }

  #hasHumanAnswer(callId: string): boolean {
    return this.#items.some((item) => item.type === 'message' && item.source === 'human_input'
      && item.interaction === 'answer' && item.callId === callId)
  }

  #newId(): string {
    return `ui-${this.#nextItemId++}`
  }
}

function readQuestion(input: unknown): string | undefined {
  if (!input || typeof input !== 'object' || !('question' in input)) return undefined
  const question = (input as { question?: unknown }).question
  return typeof question === 'string' && question.trim() ? question : undefined
}

function containsHumanInputCall(messages: readonly AgentMessage[], callId: string): boolean {
  return messages.some((message) => message.role === 'assistant' && message.toolCalls?.some((call) => (
    call.name === HUMAN_INPUT_TOOL_NAME && call.callId === callId
  )))
}

function readAnswer(content: string): string | undefined {
  if (content.endsWith('\n[truncated]')) return undefined
  try {
    const value: unknown = JSON.parse(content)
    if (!value || typeof value !== 'object' || !('answer' in value)) return undefined
    const answer = (value as { answer?: unknown }).answer
    return typeof answer === 'string' ? answer : undefined
  } catch {
    return undefined
  }
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}
