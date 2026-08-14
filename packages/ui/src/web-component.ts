import { createAgentUIStore } from './index.js'
import type { AgentUIAdapter, AgentUIState, AgentUIStore } from './types.js'

export interface KarkataPanelLabels {
  readonly send: string
  readonly abort: string
  readonly retry: string
  readonly messagePlaceholder: string
  readonly responsePlaceholder: string
  readonly contextSnapshot: string
  readonly empty: string
  readonly statusIdle: string
  readonly statusRunning: string
  readonly statusWaitingForInput: string
  readonly statusCompleted: string
  readonly statusError: string
  readonly statusAborted: string
  readonly statusDisposed: string
  readonly requestPending: string
  readonly requestCancelled: string
  readonly toolPending: string
  readonly toolCompleted: string
  readonly toolError: string
  readonly responseRejected: string
  readonly operationFailed: string
}

export interface KarkataPanelElement extends HTMLElement {
  agent: AgentUIAdapter | null
  store: AgentUIStore | null
  labels: Partial<KarkataPanelLabels> | null
  showTools: boolean
}

const definitions = new WeakMap<CustomElementRegistry, Map<string, CustomElementConstructor>>()
const DEFAULT_LABELS: KarkataPanelLabels = Object.freeze({
  send: 'Send',
  abort: 'Stop',
  retry: 'Retry',
  messagePlaceholder: 'Message',
  responsePlaceholder: 'Reply',
  contextSnapshot: 'Context snapshot',
  empty: 'Start a conversation',
  statusIdle: 'Ready',
  statusRunning: 'Working',
  statusWaitingForInput: 'Waiting for your response',
  statusCompleted: 'Completed',
  statusError: 'Something went wrong',
  statusAborted: 'Stopped',
  statusDisposed: 'Unavailable',
  requestPending: 'Waiting for your response',
  requestCancelled: 'Cancelled',
  toolPending: 'Working',
  toolCompleted: 'Completed',
  toolError: 'Failed',
  responseRejected: 'This question is no longer active.',
  operationFailed: 'The operation failed.',
})

export function defineKarkataPanel(tagName = 'karkata-panel'): CustomElementConstructor {
  const registry = globalThis.customElements
  const Base = globalThis.HTMLElement
  if (!registry || !Base || typeof Base.prototype.attachShadow !== 'function') {
    throw new Error('Custom Elements and Shadow DOM are required to define KarkataPanel')
  }

  let registered = definitions.get(registry)
  if (!registered) {
    registered = new Map()
    definitions.set(registry, registered)
  }
  const existing = registry.get(tagName)
  if (existing) {
    if (registered.get(tagName) === existing) return existing
    throw new Error(`Custom element is already registered: ${tagName}`)
  }

  const Panel = createPanelConstructor(Base)
  registry.define(tagName, Panel)
  registered.set(tagName, Panel)
  return Panel
}

function createPanelConstructor(Base: typeof HTMLElement): CustomElementConstructor {
  return class KarkataPanel extends Base implements KarkataPanelElement {
    #agent: AgentUIAdapter | null = null
    #externalStore: AgentUIStore | null = null
    #ownedStore: AgentUIStore | null = null
    #boundStore: AgentUIStore | null = null
    #unsubscribe: (() => void) | undefined
    #labels: Partial<KarkataPanelLabels> | null = null
    #showTools = false
    readonly #root: ShadowRoot
    readonly #status: HTMLElement
    readonly #context: HTMLElement
    readonly #messages: HTMLElement
    readonly #empty: HTMLElement
    readonly #error: HTMLElement
    readonly #errorMessage: HTMLElement
    readonly #retryButton: HTMLButtonElement
    readonly #form: HTMLFormElement
    readonly #textarea: HTMLTextAreaElement
    readonly #submitButton: HTMLButtonElement
    readonly #abortButton: HTMLButtonElement
    readonly #itemElements = new Map<string, HTMLElement>()
    #localError = ''
    #retryMessage: string | undefined

    constructor() {
      super()
      this.#root = this.attachShadow({ mode: 'open' })
      const doc = this.ownerDocument
      const style = doc.createElement('style')
      style.textContent = PANEL_STYLES
      const panel = doc.createElement('section')
      panel.setAttribute('part', 'panel')

      const header = doc.createElement('header')
      header.setAttribute('part', 'header')
      this.#status = doc.createElement('span')
      this.#status.setAttribute('part', 'status')
      this.#status.setAttribute('aria-live', 'polite')
      this.#context = doc.createElement('span')
      this.#context.setAttribute('part', 'context')
      header.append(this.#status, this.#context)

      this.#messages = doc.createElement('div')
      this.#messages.setAttribute('part', 'messages')
      this.#messages.setAttribute('role', 'log')
      this.#messages.setAttribute('aria-live', 'polite')
      this.#messages.setAttribute('aria-relevant', 'additions text')
      this.#empty = doc.createElement('div')
      this.#empty.setAttribute('part', 'empty')
      this.#empty.className = 'empty'
      this.#messages.append(this.#empty)

      this.#error = doc.createElement('div')
      this.#error.setAttribute('part', 'error')
      this.#error.setAttribute('role', 'alert')
      this.#errorMessage = doc.createElement('span')
      this.#errorMessage.className = 'error-message'
      this.#retryButton = doc.createElement('button')
      this.#retryButton.type = 'button'
      this.#retryButton.setAttribute('part', 'retry')
      this.#retryButton.textContent = '\u21bb'
      this.#retryButton.hidden = true
      this.#error.append(this.#errorMessage, this.#retryButton)

      this.#form = doc.createElement('form')
      this.#form.setAttribute('part', 'composer')
      this.#textarea = doc.createElement('textarea')
      this.#textarea.rows = 2
      this.#textarea.setAttribute('aria-label', DEFAULT_LABELS.messagePlaceholder)
      const actions = doc.createElement('div')
      actions.className = 'actions'
      this.#submitButton = doc.createElement('button')
      this.#submitButton.type = 'submit'
      this.#submitButton.setAttribute('part', 'submit')
      this.#submitButton.textContent = '\u2191'
      this.#abortButton = doc.createElement('button')
      this.#abortButton.type = 'button'
      this.#abortButton.setAttribute('part', 'abort')
      this.#abortButton.textContent = '\u25a0'
      actions.append(this.#abortButton, this.#submitButton)
      this.#form.append(this.#textarea, actions)
      panel.append(header, this.#messages, this.#error, this.#form)
      this.#root.replaceChildren(style, panel)

      this.#form.addEventListener('submit', (event) => {
        event.preventDefault()
        void this.#submitInput()
      })
      this.#textarea.addEventListener('input', () => { this.#updateControls() })
      this.#textarea.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
          event.preventDefault()
          this.#form.requestSubmit()
        }
      })
      this.#abortButton.addEventListener('click', () => { this.#boundStore?.abort() })
      this.#retryButton.addEventListener('click', () => { void this.#retryFailedMessage() })
      this.#render()
    }

    get agent(): AgentUIAdapter | null { return this.#agent }
    set agent(value: AgentUIAdapter | null) {
      if (value === this.#agent && this.#externalStore === null) return
      this.#releaseBinding()
      this.#externalStore = null
      this.#agent = value
      if (this.isConnected) this.#bind()
    }

    get store(): AgentUIStore | null { return this.#externalStore ?? this.#ownedStore }
    set store(value: AgentUIStore | null) {
      if (value === this.#externalStore && this.#agent === null) return
      this.#releaseBinding()
      this.#agent = null
      this.#externalStore = value
      if (this.isConnected) this.#bind()
    }

    get labels(): Partial<KarkataPanelLabels> | null { return this.#labels }
    set labels(value: Partial<KarkataPanelLabels> | null) {
      this.#labels = value ? Object.freeze({ ...value }) : null
      this.#render()
    }

    get showTools(): boolean { return this.#showTools }
    set showTools(value: boolean) {
      const next = Boolean(value)
      if (next === this.#showTools) return
      this.#showTools = next
      this.#render()
    }

    connectedCallback(): void {
      this.#bind()
    }

    disconnectedCallback(): void {
      this.#releaseBinding()
    }

    #bind(): void {
      if (this.#boundStore) return
      if (this.#externalStore) {
        this.#boundStore = this.#externalStore
      } else if (this.#agent) {
        this.#ownedStore = createAgentUIStore(this.#agent)
        this.#boundStore = this.#ownedStore
      }
      if (!this.#boundStore) {
        this.#render()
        return
      }
      this.#unsubscribe = this.#boundStore.subscribe(() => { this.#render() })
      this.#render()
    }

    #releaseBinding(): void {
      this.#unsubscribe?.()
      this.#unsubscribe = undefined
      this.#boundStore = null
      this.#ownedStore?.dispose()
      this.#ownedStore = null
    }

    #render(): void {
      const state = this.#boundStore?.getSnapshot()
      const labels = labelsFor(this.#labels)
      this.#status.textContent = state
        ? `${statusLabel(state.status, labels)}${this.#showTools && state.activeToolName ? ` \u00b7 ${state.activeToolName}` : ''}`
        : ''
      this.#context.textContent = state?.contextUsage
        ? `${state.contextUsage.usedTokens} / ${state.contextUsage.maxTokens}`
        : ''
      this.#context.hidden = !state?.contextUsage
      this.#errorMessage.textContent = this.#localError || state?.error?.message || ''
      this.#retryMessage = state ? findRetryMessage(state) : undefined
      this.#retryButton.hidden = this.#retryMessage === undefined
      this.#retryButton.title = labels.retry
      this.#retryButton.setAttribute('aria-label', labels.retry)
      this.#error.hidden = !this.#errorMessage.textContent && this.#retryButton.hidden
      this.#renderItems(state?.items ?? [], labels, Boolean(state))
      this.#textarea.placeholder = state?.composer.mode === 'response'
        ? labels.responsePlaceholder
        : labels.messagePlaceholder
      this.#textarea.setAttribute('aria-label', this.#textarea.placeholder)
      this.#submitButton.title = labels.send
      this.#submitButton.setAttribute('aria-label', labels.send)
      this.#abortButton.title = labels.abort
      this.#abortButton.setAttribute('aria-label', labels.abort)
      this.#updateControls()
    }

    #renderItems(items: AgentUIState['items'], labels: KarkataPanelLabels, hasState: boolean): void {
      const nearBottom = this.#messages.scrollHeight - this.#messages.clientHeight - this.#messages.scrollTop < 48
      const visibleItems = this.#showTools ? items : items.filter((item) => item.type !== 'tool')
      this.#empty.textContent = labels.empty
      this.#empty.hidden = !hasState || visibleItems.length > 0
      const nextIds = new Set(visibleItems.map((item) => item.id))
      for (const [id, element] of this.#itemElements) {
        if (!nextIds.has(id)) {
          element.remove()
          this.#itemElements.delete(id)
        }
      }
      for (const item of visibleItems) {
        let element = this.#itemElements.get(item.id)
        if (!element) {
          element = this.ownerDocument.createElement(item.type === 'message' ? 'article' : 'div')
          element.dataset.itemId = item.id
          this.#itemElements.set(item.id, element)
        }
        element.replaceChildren()
        element.dataset.runStatus = item.runStatus
        if (item.type === 'tool') {
          element.setAttribute('part', 'tool')
          element.className = `tool tool-${item.status}`
          element.textContent = `${item.name} \u00b7 ${toolStatusLabel(item.status, labels)}`
        } else {
          element.setAttribute('part', `message message-${item.role}`)
          element.className = `message message-${item.role} source-${item.source}`
          if (item.source === 'context_snapshot') {
            const context = this.ownerDocument.createElement('span')
            context.className = 'context-label'
            context.textContent = labels.contextSnapshot
            element.append(context)
          }
          const content = this.ownerDocument.createElement('div')
          content.className = 'message-content'
          content.textContent = item.content
          element.append(content)
          if (item.source === 'human_input' && item.interaction === 'question'
            && item.requestStatus !== 'answered') {
            const requestStatus = this.ownerDocument.createElement('span')
            requestStatus.className = 'request-status'
            requestStatus.textContent = item.requestStatus === 'pending'
              ? labels.requestPending
              : labels.requestCancelled
            element.append(requestStatus)
          }
        }
        this.#messages.append(element)
      }
      if (nearBottom) this.#messages.scrollTop = this.#messages.scrollHeight
    }

    #updateControls(): void {
      const state = this.#boundStore?.getSnapshot()
      const canSubmit = Boolean(state && (
        state.status === 'idle' || state.status === 'completed' || state.status === 'error'
        || state.status === 'aborted' || (state.status === 'waiting_for_input' && state.composer.mode === 'response')
      ))
      this.#textarea.disabled = !canSubmit
      this.#submitButton.disabled = !canSubmit || !this.#textarea.value.trim()
      const active = state?.status === 'running' || state?.status === 'waiting_for_input'
      this.#abortButton.disabled = !active
      this.#abortButton.dataset.active = String(active)
    }

    async #submitInput(): Promise<void> {
      const store = this.#boundStore
      const value = this.#textarea.value
      if (!store || !value.trim()) return
      const mode = store.getSnapshot().composer.mode
      this.#localError = ''
      let submission: ReturnType<AgentUIStore['submit']>
      try {
        submission = store.submit(value)
      } catch (error) {
        this.#setSubmissionError(store, error)
        this.#render()
        return
      }
      if (mode === 'message') this.#textarea.value = ''
      this.#updateControls()
      try {
        const result = await submission
        if (this.#boundStore !== store) return
        if (result.type === 'response') {
          if (result.accepted) this.#textarea.value = ''
          else this.#localError = labelsFor(this.#labels).responseRejected
        }
      } catch (error) {
        if (this.#boundStore !== store) return
        if (mode === 'message' && !this.#textarea.value) this.#textarea.value = value
        this.#setSubmissionError(store, error)
      }
      this.#render()
    }

    async #retryFailedMessage(): Promise<void> {
      const store = this.#boundStore
      const value = this.#retryMessage
      if (!store || !value) return
      this.#localError = ''
      this.#render()
      try {
        await store.submit(value)
      } catch (error) {
        if (!this.#setSubmissionError(store, error)) return
      }
      if (this.#boundStore === store) this.#render()
    }

    #setSubmissionError(store: AgentUIStore, error: unknown): boolean {
      if (this.#boundStore !== store) return false
      this.#localError = errorMessage(error, labelsFor(this.#labels).operationFailed)
      return true
    }
  }
}

function labelsFor(labels: Partial<KarkataPanelLabels> | null): KarkataPanelLabels {
  return { ...DEFAULT_LABELS, ...labels }
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function findRetryMessage(state: Readonly<AgentUIState>): string | undefined {
  if (state.status !== 'error' || !state.error?.retryable || !state.runId) return undefined
  for (let index = state.items.length - 1; index >= 0; index--) {
    const item = state.items[index]
    if (item?.type === 'message' && item.role === 'user' && item.source === 'conversation'
      && item.runStatus === 'error' && item.runId === state.runId) return item.content
  }
  return undefined
}

function statusLabel(status: AgentUIState['status'], labels: KarkataPanelLabels): string {
  switch (status) {
    case 'idle': return labels.statusIdle
    case 'running': return labels.statusRunning
    case 'waiting_for_input': return labels.statusWaitingForInput
    case 'completed': return labels.statusCompleted
    case 'error': return labels.statusError
    case 'aborted': return labels.statusAborted
    case 'disposed': return labels.statusDisposed
  }
}

function toolStatusLabel(status: Extract<AgentUIState['items'][number], { type: 'tool' }>['status'], labels: KarkataPanelLabels): string {
  switch (status) {
    case 'pending': return labels.toolPending
    case 'completed': return labels.toolCompleted
    case 'error': return labels.toolError
  }
}

const PANEL_STYLES = `
:host {
  --karkata-background: #ffffff;
  --karkata-surface: #f5f6f7;
  --karkata-border: #d7dadd;
  --karkata-text: #181a1b;
  --karkata-muted: #62686d;
  --karkata-accent: #19704a;
  --karkata-danger: #b42318;
  display: block;
  min-width: 0;
  color: var(--karkata-text);
  font: 14px/1.5 system-ui, sans-serif;
}

[part='panel'] {
  display: grid;
  grid-template-rows: auto minmax(12rem, 1fr) auto auto;
  min-height: 22rem;
  max-height: 42rem;
  overflow: hidden;
  background: var(--karkata-background);
  border: 1px solid var(--karkata-border);
  border-radius: 8px;
}

[part='header'] {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 2.5rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--karkata-border);
}

[part='status'] { font-weight: 600; }
[part='context'] { color: var(--karkata-muted); font-variant-numeric: tabular-nums; }

[part='messages'] {
  min-width: 0;
  overflow: auto;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.empty {
  margin: auto;
  padding: 1rem;
  color: var(--karkata-muted);
  text-align: center;
}
.empty[hidden] { display: none; }

.message {
  width: fit-content;
  max-width: min(85%, 42rem);
  padding: 0.5rem 0.625rem;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  background: var(--karkata-surface);
  border: 1px solid transparent;
  border-radius: 8px;
}

.message-user { align-self: flex-end; border-color: color-mix(in srgb, var(--karkata-accent) 35%, transparent); }
.message-assistant { align-self: flex-start; }
.source-context_snapshot { border-style: dashed; color: var(--karkata-muted); }
.context-label, .request-status { display: block; margin-bottom: 0.2rem; color: var(--karkata-muted); font-size: 0.75rem; }

.tool {
  align-self: stretch;
  min-width: 0;
  padding: 0.4rem 0.5rem;
  overflow-wrap: anywhere;
  color: var(--karkata-muted);
  background: var(--karkata-surface);
  border-left: 3px solid var(--karkata-border);
}
.tool-completed { border-left-color: var(--karkata-accent); }
.tool-error { border-left-color: var(--karkata-danger); }

[part='error'] {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.4rem 0.75rem;
  color: var(--karkata-danger);
  border-top: 1px solid var(--karkata-border);
}
[part='error'][hidden] { display: none; }
.error-message { min-width: 0; overflow-wrap: anywhere; }
[part='retry'] { width: 2rem; height: 2rem; flex: none; color: var(--karkata-danger); }
[part='retry'][hidden] { display: none; }

[part='composer'] {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.5rem;
  padding: 0.625rem;
  border-top: 1px solid var(--karkata-border);
}

textarea {
  box-sizing: border-box;
  width: 100%;
  min-height: 2.5rem;
  max-height: 8rem;
  resize: vertical;
  padding: 0.5rem 0.625rem;
  color: inherit;
  background: var(--karkata-background);
  border: 1px solid var(--karkata-border);
  border-radius: 6px;
  font: inherit;
}

textarea:focus-visible, button:focus-visible { outline: 2px solid var(--karkata-accent); outline-offset: 2px; }
.actions { display: flex; align-items: flex-end; gap: 0.375rem; }
button {
  width: 2.5rem;
  height: 2.5rem;
  padding: 0;
  border: 1px solid var(--karkata-border);
  border-radius: 6px;
  color: var(--karkata-text);
  background: var(--karkata-surface);
  font: 600 1rem/1 system-ui, sans-serif;
  cursor: pointer;
}
[part='submit']:not(:disabled) { color: #ffffff; background: var(--karkata-accent); border-color: var(--karkata-accent); }
[part='abort'] { color: var(--karkata-danger); }
[part='abort'][data-active='false'] { visibility: hidden; }
button:disabled, textarea:disabled { cursor: default; opacity: 0.55; }

@media (max-width: 32rem) {
  [part='panel'] { min-height: 18rem; max-height: 100dvh; border-radius: 0; }
  .message { max-width: 92%; }
  [part='composer'] { padding: 0.5rem; }
}
`
