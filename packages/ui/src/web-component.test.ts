// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AgentRequestListener, AgentResult, AgentStateListener } from '@karkata/core'
import type { AgentUIAdapter, AgentUIState, AgentUIStore } from './index.js'
import {
  defineKarkataPanel,
  type KarkataPanelElement,
} from './web-component.js'

class FakeStore implements AgentUIStore {
  #listeners = new Set<() => void>()
  snapshot: Readonly<AgentUIState> = Object.freeze({
    items: [], composer: Object.freeze({ mode: 'message' }), historyCompleteness: 'session',
    status: 'idle', revision: 0,
  })
  readonly submit = vi.fn(async (_input: string) => ({
    type: 'message' as const,
    result: { status: 'completed' as const, runId: 'run', content: 'done', steps: 1 },
  }))
  readonly abort = vi.fn()
  readonly dispose = vi.fn()

  getSnapshot(): Readonly<AgentUIState> { return this.snapshot }
  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener)
    return () => { this.#listeners.delete(listener) }
  }
  publish(patch: Partial<AgentUIState>): void {
    this.snapshot = Object.freeze({ ...this.snapshot, ...patch, revision: this.snapshot.revision + 1 })
    for (const listener of this.#listeners) listener()
  }
  get listenerCount(): number { return this.#listeners.size }
}

class FakePanelAgent implements AgentUIAdapter {
  #states = new Set<AgentStateListener>()
  #requests = new Set<AgentRequestListener>()
  readonly send = vi.fn(async (_message: string): Promise<AgentResult> => ({
    status: 'completed', runId: 'run', content: 'done', steps: 1,
  }))
  readonly respond = vi.fn(() => false)
  readonly abort = vi.fn()

  subscribe(listener: AgentStateListener): () => void {
    this.#states.add(listener)
    listener({ status: 'idle', step: 0, messages: [], updatedAt: 1 })
    return () => { this.#states.delete(listener) }
  }
  subscribeRequests(listener: AgentRequestListener): () => void {
    this.#requests.add(listener)
    return () => { this.#requests.delete(listener) }
  }
  get subscriptionCounts(): { states: number; requests: number } {
    return { states: this.#states.size, requests: this.#requests.size }
  }
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('defineKarkataPanel', () => {
  it('registers idempotently and rejects a conflicting definition', () => {
    const tagName = 'karkata-test-registration'
    const first = defineKarkataPanel(tagName)
    expect(defineKarkataPanel(tagName)).toBe(first)
    expect(customElements.get(tagName)).toBe(first)

    const conflict = 'karkata-test-conflict'
    customElements.define(conflict, class extends HTMLElement {})
    expect(() => defineKarkataPanel(conflict)).toThrow('already registered')
  })

  it('subscribes to an external Store only while connected and never disposes it', () => {
    const tagName = 'karkata-test-lifecycle'
    defineKarkataPanel(tagName)
    const panel = document.createElement(tagName) as KarkataPanelElement
    const first = new FakeStore()
    const second = new FakeStore()

    panel.store = first
    expect(first.listenerCount).toBe(0)
    document.body.append(panel)
    expect(first.listenerCount).toBe(1)

    panel.store = second
    expect(first.listenerCount).toBe(0)
    expect(second.listenerCount).toBe(1)
    expect(first.dispose).not.toHaveBeenCalled()

    panel.remove()
    expect(second.listenerCount).toBe(0)
    expect(second.dispose).not.toHaveBeenCalled()
    document.body.append(panel)
    expect(second.listenerCount).toBe(1)
  })

  it('owns and recreates the convenience Store when an Agent-bound panel reconnects', () => {
    const tagName = 'karkata-test-agent-lifecycle'
    defineKarkataPanel(tagName)
    const panel = document.createElement(tagName) as KarkataPanelElement
    const agent = new FakePanelAgent()
    panel.agent = agent

    document.body.append(panel)
    expect(agent.subscriptionCounts).toEqual({ states: 1, requests: 1 })
    expect(panel.store).not.toBeNull()

    panel.remove()
    expect(agent.subscriptionCounts).toEqual({ states: 0, requests: 0 })
    expect(panel.store).toBeNull()
    document.body.append(panel)
    expect(agent.subscriptionCounts).toEqual({ states: 1, requests: 1 })
  })

  it('renders safe conversation items and consumer labels while hiding tool protocol details by default', () => {
    const tagName = 'karkata-test-rendering'
    defineKarkataPanel(tagName)
    const panel = document.createElement(tagName) as KarkataPanelElement
    const store = new FakeStore()
    store.snapshot = Object.freeze({
      items: [
        {
          type: 'message', id: 'context', runStatus: 'unknown', role: 'user',
          source: 'context_snapshot', content: 'Earlier summary',
        },
        {
          type: 'message', id: 'user', runId: 'run', runStatus: 'active', role: 'user',
          source: 'conversation', content: '<img src=x onerror=alert(1)>',
        },
        {
          type: 'message', id: 'question', runId: 'run', runStatus: 'active', role: 'assistant',
          source: 'human_input', interaction: 'question', requestId: 'request', callId: 'call-question',
          requestStatus: 'pending', content: 'Continue?',
        },
        {
          type: 'tool', id: 'tool', runId: 'run', runStatus: 'active', callId: 'call-tool',
          name: 'lookup', status: 'completed',
        },
      ],
      composer: { mode: 'response', requestId: 'request', callId: 'call-question', prompt: 'Continue?' },
      historyCompleteness: 'context_only', status: 'waiting_for_input', runId: 'run',
      activeToolName: 'lookup', contextUsage: { maxTokens: 100, usedTokens: 25 }, revision: 4,
    })
    panel.labels = {
      send: 'Submit', abort: 'Cancel', responsePlaceholder: 'Type your answer', contextSnapshot: 'Context',
      statusWaitingForInput: 'Waiting for you', requestPending: 'Needs your answer', toolCompleted: 'Finished',
    }
    panel.store = store
    document.body.append(panel)

    const root = panel.shadowRoot!
    expect(root.querySelector('[part="messages"]')?.textContent).toContain('Earlier summary')
    expect(root.querySelector('[part="messages"]')?.textContent).toContain('<img src=x onerror=alert(1)>')
    expect(root.querySelector('[part="messages"]')?.textContent).toContain('Continue?')
    expect(root.querySelector('[part="messages"]')?.textContent).toContain('Needs your answer')
    expect(root.querySelector('[part="messages"]')?.textContent).not.toContain('pending')
    expect(root.querySelector('[part="status"]')?.textContent).toBe('Waiting for you')
    expect(root.querySelector('[part="tool"]')).toBeNull()
    expect(root.querySelector('img')).toBeNull()
    expect(root.querySelector('[part="context"]')?.textContent).toContain('25 / 100')
    expect(root.querySelector('textarea')?.placeholder).toBe('Type your answer')
    expect(root.querySelector('[part="submit"]')?.getAttribute('aria-label')).toBe('Submit')
    expect(root.querySelector('[part="abort"]')?.getAttribute('aria-label')).toBe('Cancel')
    expect(root.querySelector('[data-item-id="context"]')?.textContent).toContain('Context')

    panel.showTools = true
    expect(root.querySelector('[part="tool"]')?.textContent).toBe('lookup · Finished')
    expect(root.querySelector('[part="status"]')?.textContent).toBe('Waiting for you · lookup')
  })

  it('renders a natural empty state until the first visible message arrives', () => {
    const tagName = 'karkata-test-empty'
    defineKarkataPanel(tagName)
    const panel = document.createElement(tagName) as KarkataPanelElement
    const store = new FakeStore()
    panel.store = store
    document.body.append(panel)

    const root = panel.shadowRoot!
    expect(root.querySelector('[part="status"]')?.textContent).toBe('Ready')
    expect(root.querySelector('[part="empty"]')?.textContent).toBe('Start a conversation')
    expect(root.querySelector<HTMLElement>('[part="empty"]')?.hidden).toBe(false)

    store.publish({
      items: [{
        type: 'message', id: 'first', runId: 'run', runStatus: 'active',
        role: 'user', source: 'conversation', content: 'Hello',
      }],
      status: 'running',
    })

    expect(root.querySelector('[part="status"]')?.textContent).toBe('Working')
    expect(root.querySelector<HTMLElement>('[part="empty"]')?.hidden).toBe(true)
  })

  it('offers an accessible retry for a retryable failed user run and preserves the current draft', async () => {
    const tagName = 'karkata-test-retry'
    defineKarkataPanel(tagName)
    const panel = document.createElement(tagName) as KarkataPanelElement
    const store = new FakeStore()
    store.snapshot = Object.freeze({
      items: [{
        type: 'message', id: 'failed-user', runId: 'failed-run', runStatus: 'error',
        role: 'user', source: 'conversation', content: 'Try this request again',
      }],
      composer: { mode: 'message' }, historyCompleteness: 'session', status: 'error', runId: 'failed-run',
      error: { code: 'MODEL_NETWORK_ERROR', message: 'Connection was interrupted', retryable: true }, revision: 2,
    })
    panel.labels = { retry: 'Try again' }
    panel.store = store
    document.body.append(panel)
    const root = panel.shadowRoot!
    const textarea = root.querySelector('textarea')!
    textarea.value = 'Keep this draft'

    const retry = root.querySelector<HTMLButtonElement>('[part="retry"]')!
    expect(retry.hidden).toBe(false)
    expect(retry.getAttribute('aria-label')).toBe('Try again')
    retry.click()

    await vi.waitFor(() => { expect(store.submit).toHaveBeenCalledWith('Try this request again') })
    expect(textarea.value).toBe('Keep this draft')
  })

  it('does not offer retry for non-retryable errors or non-conversation answers', () => {
    const tagName = 'karkata-test-no-retry'
    defineKarkataPanel(tagName)
    const panel = document.createElement(tagName) as KarkataPanelElement
    const store = new FakeStore()
    store.snapshot = Object.freeze({
      items: [{
        type: 'message', id: 'answer', runId: 'failed-run', runStatus: 'error', role: 'user',
        source: 'human_input', interaction: 'answer', requestId: 'request', callId: 'call', content: 'Yes',
      }],
      composer: { mode: 'message' }, historyCompleteness: 'session', status: 'error', runId: 'failed-run',
      error: { code: 'MODEL_AUTH_ERROR', message: 'Authentication failed', retryable: false }, revision: 2,
    })
    panel.store = store
    document.body.append(panel)
    const retry = panel.shadowRoot!.querySelector<HTMLButtonElement>('[part="retry"]')!
    expect(retry.hidden).toBe(true)

    store.publish({ error: { code: 'MODEL_NETWORK_ERROR', message: 'Network failed', retryable: true } })
    expect(retry.hidden).toBe(true)
  })

  it('uses one composer, preserves rejected answers, forwards abort, and ignores IME Enter', async () => {
    const tagName = 'karkata-test-interaction'
    defineKarkataPanel(tagName)
    const panel = document.createElement(tagName) as KarkataPanelElement
    const store = new FakeStore()
    panel.labels = { responseRejected: 'This answer can no longer be submitted.' }
    panel.store = store
    document.body.append(panel)
    const root = panel.shadowRoot!
    const textarea = root.querySelector('textarea')!
    const form = root.querySelector('form')!

    textarea.value = 'hello'
    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }))
    await vi.waitFor(() => { expect(store.submit).toHaveBeenCalledWith('hello') })
    expect(textarea.value).toBe('')

    store.publish({
      status: 'waiting_for_input',
      composer: { mode: 'response', requestId: 'request', callId: 'call', prompt: 'Continue?' },
    })
    store.submit.mockResolvedValueOnce({ type: 'response', accepted: false })
    textarea.value = 'keep this answer'
    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }))
    await vi.waitFor(() => { expect(store.submit).toHaveBeenCalledWith('keep this answer') })
    expect(textarea.value).toBe('keep this answer')
    expect(root.querySelector('[part="error"]')?.textContent).toContain('This answer can no longer be submitted.')

    root.querySelector<HTMLButtonElement>('[part="abort"]')!.click()
    expect(store.abort).toHaveBeenCalledOnce()

    store.publish({ status: 'completed', composer: { mode: 'message' } })
    store.submit.mockClear()
    textarea.value = '中文输入'
    textarea.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter', isComposing: true, bubbles: true, cancelable: true,
    }))
    expect(store.submit).not.toHaveBeenCalled()
  })

  it('ignores a submission result from a Store that has been replaced', async () => {
    const tagName = 'karkata-test-late-submission'
    defineKarkataPanel(tagName)
    const panel = document.createElement(tagName) as KarkataPanelElement
    const oldStore = new FakeStore()
    oldStore.snapshot = Object.freeze({
      ...oldStore.snapshot,
      status: 'waiting_for_input',
      composer: { mode: 'response', requestId: 'old', callId: 'old-call', prompt: 'Old?' },
    })
    let resolveOld!: (result: { type: 'response'; accepted: boolean }) => void
    oldStore.submit.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve }))
    panel.store = oldStore
    document.body.append(panel)
    const textarea = panel.shadowRoot!.querySelector('textarea')!
    const form = panel.shadowRoot!.querySelector('form')!
    textarea.value = 'old answer'
    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }))
    expect(oldStore.submit).toHaveBeenCalledWith('old answer')

    const newStore = new FakeStore()
    panel.store = newStore
    textarea.value = 'new draft'
    resolveOld({ type: 'response', accepted: true })
    await Promise.resolve()
    await Promise.resolve()

    expect(textarea.value).toBe('new draft')
    expect(panel.store).toBe(newStore)
  })
})
