import { describe, expect, it, vi } from 'vitest'
import type {
  AgentMessage,
  AgentRequest,
  AgentRequestListener,
  AgentResult,
  AgentState,
  AgentStateListener,
} from '@karkata/core'
import { createAgentUIStore, type AgentUIAdapter } from './index.js'

class FakeAgent implements AgentUIAdapter {
  #stateListeners = new Set<AgentStateListener>()
  #requestListeners = new Set<AgentRequestListener>()
  state: AgentState = { status: 'idle', step: 0, messages: [], updatedAt: 1 }
  request: AgentRequest | undefined
  readonly send = vi.fn(async (_message: string): Promise<AgentResult> => ({
    status: 'completed', runId: 'unused', content: 'done', steps: 1,
  }))
  readonly respond = vi.fn((_requestId: string, _answer: string) => false)
  readonly abort = vi.fn()

  subscribe(listener: AgentStateListener): () => void {
    this.#stateListeners.add(listener)
    listener(this.state)
    return () => { this.#stateListeners.delete(listener) }
  }

  subscribeRequests(listener: AgentRequestListener): () => void {
    this.#requestListeners.add(listener)
    if (this.request) listener(this.request)
    return () => { this.#requestListeners.delete(listener) }
  }

  publishState(patch: Partial<AgentState>): void {
    this.state = { ...this.state, ...patch, updatedAt: this.state.updatedAt + 1 }
    for (const listener of this.#stateListeners) listener(this.state)
  }

  publishRequest(request: AgentRequest): void {
    this.request = request
    for (const listener of this.#requestListeners) listener(request)
  }

  get subscriptionCounts(): { states: number; requests: number } {
    return { states: this.#stateListeners.size, requests: this.#requestListeners.size }
  }
}

describe('createAgentUIStore', () => {
  it('creates a stable safe snapshot from the synchronously replayed Agent state', () => {
    const agent = new FakeAgent()
    const store = createAgentUIStore(agent)

    const initial = store.getSnapshot()
    expect(initial).toMatchObject({
      items: [],
      composer: { mode: 'message' },
      historyCompleteness: 'session',
      status: 'idle',
      revision: 0,
    })
    expect(store.getSnapshot()).toBe(initial)
    expect(initial).not.toHaveProperty('messages')

    const listener = vi.fn()
    const throwing = store.subscribe(() => { throw new Error('view failed') })
    const unsubscribe = store.subscribe(listener)
    agent.publishState({ contextUsage: { maxTokens: 100, usedTokens: 25 } })

    expect(listener).toHaveBeenCalledOnce()
    expect(store.getSnapshot()).not.toBe(initial)
    expect(store.getSnapshot()).toMatchObject({
      contextUsage: { maxTokens: 100, usedTokens: 25 },
      revision: 1,
    })

    throwing()
    unsubscribe()
  })

  it('disposes idempotently without aborting the Agent', () => {
    const agent = new FakeAgent()
    const store = createAgentUIStore(agent)
    expect(agent.subscriptionCounts).toEqual({ states: 1, requests: 1 })

    store.dispose()
    store.dispose()

    expect(agent.subscriptionCounts).toEqual({ states: 0, requests: 0 })
    expect(agent.abort).not.toHaveBeenCalled()
  })

  it('marks pre-existing model context as incomplete and omits unsafe tool payloads', () => {
    const agent = new FakeAgent()
    agent.state = {
      status: 'completed',
      runId: 'old-run',
      step: 1,
      messages: [
        { role: 'system', content: 'internal summary control' },
        { role: 'user', content: 'Previous conversation summary' },
        {
          role: 'assistant',
          content: null,
          toolCalls: [{ callId: 'call-old', name: 'lookup_secret', input: { token: 'secret' } }],
        },
        { role: 'tool', callId: 'call-old', name: 'lookup_secret', content: 'private result', isError: false },
      ],
      result: { status: 'completed', runId: 'old-run', content: '', steps: 1 },
      updatedAt: 1,
    }

    const snapshot = createAgentUIStore(agent).getSnapshot()

    expect(snapshot.historyCompleteness).toBe('context_only')
    expect(snapshot.items).toEqual([
      expect.objectContaining({
        type: 'message', role: 'user', source: 'context_snapshot', runStatus: 'unknown',
        content: 'Previous conversation summary',
      }),
      expect.objectContaining({
        type: 'tool', callId: 'call-old', name: 'lookup_secret', status: 'completed', runStatus: 'unknown',
      }),
    ])
    expect(snapshot.items).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ content: 'private result' }),
      expect.objectContaining({ input: { token: 'secret' } }),
    ]))
  })

  it('keeps an observed transcript across compaction and rollback until history is explicitly cleared', () => {
    const agent = new FakeAgent()
    const store = createAgentUIStore(agent)
    const firstUser = user('first question')
    const firstAssistant = assistant('first answer')

    agent.publishState({ status: 'running', runId: 'run-1', step: 0, messages: [firstUser] })
    agent.publishState({
      status: 'completed', runId: 'run-1', step: 1,
      messages: [firstUser, firstAssistant],
      result: { status: 'completed', runId: 'run-1', content: 'first answer', steps: 1 },
    })

    const secondUser = user('second question')
    const summary = user('Previous conversation summary')
    const secondAssistant = assistant('second answer')
    agent.publishState({
      status: 'running', runId: 'run-2', step: 0,
      messages: [firstUser, firstAssistant, secondUser], result: undefined,
    })
    agent.publishState({
      status: 'completed', runId: 'run-2', step: 1,
      messages: [summary, secondUser, secondAssistant],
      result: { status: 'completed', runId: 'run-2', content: 'second answer', steps: 1 },
    })

    const failedUser = user('failed question')
    agent.publishState({
      status: 'running', runId: 'run-3', step: 0,
      messages: [summary, secondUser, secondAssistant, failedUser], result: undefined, error: undefined,
    })
    agent.publishState({
      status: 'error', runId: 'run-3', step: 1,
      messages: [summary, secondUser, secondAssistant],
      result: {
        status: 'error', runId: 'run-3', steps: 1,
        error: { code: 'MODEL_ERROR', message: 'Model failed', retryable: false },
      },
      error: { code: 'MODEL_ERROR', message: 'Model failed', retryable: false },
    })

    expect(store.getSnapshot().historyCompleteness).toBe('session')
    expect(store.getSnapshot().items.map((item) => ({
      content: item.type === 'message' ? item.content : item.name,
      runStatus: item.runStatus,
    }))).toEqual([
      { content: 'first question', runStatus: 'completed' },
      { content: 'first answer', runStatus: 'completed' },
      { content: 'second question', runStatus: 'completed' },
      { content: 'second answer', runStatus: 'completed' },
      { content: 'failed question', runStatus: 'error' },
    ])

    agent.publishState({ status: 'disposed', runId: undefined, step: 0, messages: [], result: undefined, error: undefined })
    expect(store.getSnapshot().items).toHaveLength(5)

    agent.publishState({ status: 'idle', runId: undefined, step: 0, messages: [] })
    expect(store.getSnapshot()).toMatchObject({ items: [], historyCompleteness: 'session' })
  })

  it('projects tool calls by callId without exposing inputs or results', () => {
    const agent = new FakeAgent()
    const store = createAgentUIStore(agent)
    const prompt = user('inspect')
    const calling: AgentMessage = {
      role: 'assistant',
      content: 'Checking now',
      toolCalls: [{ callId: 'call-1', name: 'lookup', input: { apiKey: 'secret' } }],
    }
    const result: AgentMessage = {
      role: 'tool', callId: 'call-1', name: 'lookup', content: 'private payload', isError: false,
    }

    agent.publishState({ status: 'running', runId: 'run-tools', messages: [prompt] })
    agent.publishState({ status: 'running', runId: 'run-tools', messages: [prompt, calling] })
    const pending = store.getSnapshot().items.at(-1)
    expect(pending).toMatchObject({
      type: 'tool', callId: 'call-1', name: 'lookup', status: 'pending', runStatus: 'active',
    })
    const pendingId = pending?.id

    agent.publishState({ status: 'running', runId: 'run-tools', messages: [prompt, calling, result] })
    agent.publishState({ status: 'running', runId: 'run-tools', messages: [prompt, calling, result] })

    const projected = store.getSnapshot().items
    expect(projected).toEqual([
      expect.objectContaining({ type: 'message', content: 'inspect' }),
      expect.objectContaining({ type: 'message', content: 'Checking now' }),
      expect.objectContaining({ type: 'tool', id: pendingId, callId: 'call-1', status: 'completed' }),
    ])
    expect(JSON.stringify(projected)).not.toContain('secret')
    expect(JSON.stringify(projected)).not.toContain('private payload')

    const orphan: AgentMessage = {
      role: 'tool', callId: 'call-orphan', name: 'missing', content: 'failure details', isError: true,
    }
    agent.publishState({ status: 'running', runId: 'run-tools', messages: [prompt, calling, result, orphan] })
    expect(store.getSnapshot().items.at(-1)).toMatchObject({
      type: 'tool', callId: 'call-orphan', name: 'missing', status: 'error', runStatus: 'active',
    })
  })

  it('renders human input as ordinary messages and accepts a response while the original send is pending', async () => {
    const agent = new FakeAgent()
    const questionCall: AgentMessage = {
      role: 'assistant', content: null,
      toolCalls: [{ callId: 'call-question', name: 'ask_user', input: { question: 'Delete order 123?' } }],
    }
    const prompt = user('delete order 123')
    let resolveRun!: (result: AgentResult) => void
    const pendingRun = new Promise<AgentResult>((resolve) => { resolveRun = resolve })
    agent.send.mockImplementation((message) => {
      expect(message).toBe('delete order 123')
      agent.publishState({ status: 'running', runId: 'run-human', step: 0, messages: [prompt] })
      agent.publishState({ status: 'waiting_for_input', runId: 'run-human', step: 1, messages: [prompt, questionCall] })
      agent.publishRequest({
        type: 'human_input', id: 'request-1', callId: 'call-question', runId: 'run-human', step: 1,
        prompt: 'Delete order 123?',
      })
      return pendingRun
    })
    agent.respond.mockImplementation((requestId, answer) => {
      expect({ requestId, answer }).toEqual({ requestId: 'request-1', answer: 'Yes' })
      agent.publishState({ status: 'running' })
      return true
    })
    const store = createAgentUIStore(agent)

    const originalSubmission = store.submit('delete order 123')
    expect(store.getSnapshot().composer).toEqual({
      mode: 'response', requestId: 'request-1', callId: 'call-question', prompt: 'Delete order 123?',
    })
    expect(store.getSnapshot().items.at(-1)).toMatchObject({
      type: 'message', role: 'assistant', source: 'human_input', interaction: 'question',
      requestStatus: 'pending', content: 'Delete order 123?',
    })

    await expect(store.submit('Yes')).resolves.toEqual({ type: 'response', accepted: true })
    expect(store.getSnapshot().items.slice(-2)).toEqual([
      expect.objectContaining({
        type: 'message', role: 'assistant', source: 'human_input', interaction: 'question',
        requestStatus: 'answered', callId: 'call-question',
      }),
      expect.objectContaining({
        type: 'message', role: 'user', source: 'human_input', interaction: 'answer',
        content: 'Yes', callId: 'call-question',
      }),
    ])

    const answerResult: AgentMessage = {
      role: 'tool', callId: 'call-question', name: 'ask_user', content: '{"answer":"Yes"}', isError: false,
    }
    agent.publishState({ status: 'running', messages: [prompt, questionCall, answerResult] })
    const completed: AgentResult = { status: 'completed', runId: 'run-human', content: 'Deleted', steps: 2 }
    agent.publishState({ status: 'completed', messages: [prompt, questionCall, answerResult, assistant('Deleted')], result: completed })
    resolveRun(completed)

    await expect(originalSubmission).resolves.toEqual({ type: 'message', result: completed })
    expect(store.getSnapshot().items.filter((item) => item.type === 'message' && item.source === 'human_input')).toHaveLength(2)
  })

  it('keeps a rejected human response in response mode and never sends it as a new message', async () => {
    const agent = new FakeAgent()
    const store = createAgentUIStore(agent)
    const prompt = user('start')
    const questionCall: AgentMessage = {
      role: 'assistant', content: null,
      toolCalls: [{ callId: 'call-stale', name: 'ask_user', input: { question: 'Continue?' } }],
    }
    agent.publishState({ status: 'running', runId: 'run-stale', messages: [prompt] })
    agent.publishState({ status: 'waiting_for_input', runId: 'run-stale', messages: [prompt, questionCall] })
    agent.publishRequest({
      type: 'human_input', id: 'request-stale', callId: 'call-stale', runId: 'run-stale', step: 1,
      prompt: 'Continue?',
    })

    await expect(store.submit('draft answer')).resolves.toEqual({ type: 'response', accepted: false })

    expect(agent.send).not.toHaveBeenCalled()
    expect(store.getSnapshot().composer).toMatchObject({ mode: 'response', requestId: 'request-stale' })
    expect(store.getSnapshot().items).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ interaction: 'answer', content: 'draft answer' }),
    ]))
  })

  it('marks externally answered and cancelled questions without trusting truncated answers or late requests', () => {
    const agent = new FakeAgent()
    const store = createAgentUIStore(agent)
    const prompt = user('start')
    const questionCall: AgentMessage = {
      role: 'assistant', content: null,
      toolCalls: [{ callId: 'call-external', name: 'ask_user', input: { question: 'External?' } }],
    }
    const request: AgentRequest = {
      type: 'human_input', id: 'request-external', callId: 'call-external', runId: 'run-external', step: 1,
      prompt: 'External?',
    }
    agent.publishState({ status: 'running', runId: 'run-external', messages: [prompt] })
    agent.publishState({ status: 'waiting_for_input', runId: 'run-external', messages: [prompt, questionCall] })
    agent.publishRequest(request)

    agent.publishState({ status: 'running' })
    agent.publishState({
      status: 'running',
      messages: [
        prompt,
        questionCall,
        { role: 'tool', callId: 'call-external', name: 'ask_user', content: '{"answer":\n[truncated]', isError: false },
      ],
    })

    expect(store.getSnapshot().items).toEqual(expect.arrayContaining([
      expect.objectContaining({ interaction: 'question', requestStatus: 'answered' }),
    ]))
    expect(store.getSnapshot().items).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ interaction: 'answer' }),
    ]))

    const cancelledCall: AgentMessage = {
      role: 'assistant', content: null,
      toolCalls: [{ callId: 'call-cancelled', name: 'ask_user', input: { question: 'Cancelled?' } }],
    }
    agent.publishState({ status: 'waiting_for_input', runId: 'run-external', messages: [prompt, questionCall, cancelledCall] })
    const cancelledRequest: AgentRequest = {
      type: 'human_input', id: 'request-cancelled', callId: 'call-cancelled', runId: 'run-external', step: 1,
      prompt: 'Cancelled?',
    }
    agent.publishRequest(cancelledRequest)
    agent.publishState({
      status: 'aborted', runId: 'run-external', messages: [],
      result: { status: 'aborted', runId: 'run-external', steps: 1 },
    })

    expect(store.getSnapshot().items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        interaction: 'question', requestId: 'request-cancelled', requestStatus: 'cancelled', runStatus: 'aborted',
      }),
    ]))
    const beforeLateRequest = store.getSnapshot().items
    agent.publishRequest({
      ...cancelledRequest,
      id: 'request-too-late',
      callId: 'call-too-late',
      prompt: 'Too late?',
    })
    expect(store.getSnapshot().composer).toEqual({ mode: 'message' })
    expect(store.getSnapshot().items).toEqual(beforeLateRequest)
  })

  it('lets competing stores converge without recording a rejected duplicate response', async () => {
    const agent = new FakeAgent()
    const first = createAgentUIStore(agent)
    const second = createAgentUIStore(agent)
    const prompt = user('start')
    const questionCall: AgentMessage = {
      role: 'assistant', content: null,
      toolCalls: [{ callId: 'call-race', name: 'ask_user', input: { question: 'Approve?' } }],
    }
    agent.publishState({ status: 'running', runId: 'run-race', messages: [prompt] })
    agent.publishState({ status: 'waiting_for_input', runId: 'run-race', messages: [prompt, questionCall] })
    agent.publishRequest({
      type: 'human_input', id: 'request-race', callId: 'call-race', runId: 'run-race', step: 1,
      prompt: 'Approve?',
    })
    agent.respond.mockImplementationOnce(() => {
      agent.publishState({ status: 'running' })
      return true
    })

    await expect(first.submit('Approve')).resolves.toEqual({ type: 'response', accepted: true })
    await expect(second.submit('Also approve')).rejects.toThrow('cannot accept a new message')

    expect(first.getSnapshot().items).toEqual(expect.arrayContaining([
      expect.objectContaining({ interaction: 'answer', content: 'Approve' }),
    ]))
    expect(second.getSnapshot().items).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ interaction: 'answer' }),
    ]))
  })

  it('rejects new input while running or disposed and forwards abort only while active', async () => {
    const agent = new FakeAgent()
    const store = createAgentUIStore(agent)
    agent.publishState({ status: 'running', runId: 'run-busy', messages: [user('busy')] })

    await expect(store.submit('duplicate')).rejects.toThrow('cannot accept a new message')
    store.abort()
    expect(agent.abort).toHaveBeenCalledOnce()

    agent.publishState({ status: 'disposed', runId: undefined, messages: [] })
    await expect(store.submit('after dispose')).rejects.toThrow('cannot accept a new message')
    store.dispose()
    store.abort()
    expect(agent.abort).toHaveBeenCalledOnce()
  })

  it('marks an active run aborted when the Agent is disposed without a terminal runId', () => {
    const agent = new FakeAgent()
    const store = createAgentUIStore(agent)
    agent.publishState({ status: 'running', runId: 'run-dispose', messages: [user('unfinished')] })

    agent.publishState({ status: 'disposed', runId: undefined, step: 0, messages: [] })

    expect(store.getSnapshot().items).toEqual([
      expect.objectContaining({ content: 'unfinished', runStatus: 'aborted' }),
    ])
  })

  it('cleans up partial subscriptions when an Adapter does not synchronously replay state', () => {
    let stateSubscriptions = 0
    let requestSubscriptions = 0
    const adapter: AgentUIAdapter = {
      send: async () => ({ status: 'completed', runId: 'run', content: 'done', steps: 1 }),
      respond: () => false,
      abort: () => {},
      subscribe: () => {
        stateSubscriptions++
        return () => { stateSubscriptions-- }
      },
      subscribeRequests: () => {
        requestSubscriptions++
        return () => { requestSubscriptions-- }
      },
    }

    expect(() => createAgentUIStore(adapter)).toThrow('must synchronously replay')
    expect({ stateSubscriptions, requestSubscriptions }).toEqual({ stateSubscriptions: 0, requestSubscriptions: 0 })
  })

  it('ignores callbacks delivered after disposal by a non-conforming Adapter', () => {
    let stateListener!: AgentStateListener
    let requestListener!: AgentRequestListener
    const initial: AgentState = { status: 'idle', step: 0, messages: [], updatedAt: 1 }
    const adapter: AgentUIAdapter = {
      send: async () => ({ status: 'completed', runId: 'run', content: 'done', steps: 1 }),
      respond: () => false,
      abort: () => {},
      subscribe: (listener) => { stateListener = listener; listener(initial); return () => {} },
      subscribeRequests: (listener) => { requestListener = listener; return () => {} },
    }
    const store = createAgentUIStore(adapter)
    const before = store.getSnapshot()
    store.dispose()

    stateListener({ status: 'running', runId: 'late', step: 0, messages: [user('late')], updatedAt: 2 })
    requestListener({
      type: 'human_input', id: 'late', callId: 'late', runId: 'late', step: 1, prompt: 'late',
    })

    expect(store.getSnapshot()).toBe(before)
  })
})

function user(content: string): AgentMessage {
  return { role: 'user', content }
}

function assistant(content: string): AgentMessage {
  return { role: 'assistant', content }
}
