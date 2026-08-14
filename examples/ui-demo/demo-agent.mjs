const DEFAULT_DELAYS = Object.freeze({
  assistant: 450,
  tool: 650,
  question: 500,
  completion: 700,
})

const SEEDED_HISTORY = Object.freeze([
  Object.freeze({ role: 'user', content: 'Check order 1042 and summarize its delivery status.' }),
  Object.freeze({ role: 'assistant', content: 'Order 1042 is ready to ship. The current delivery date is Wednesday.' }),
])

export function createDemoAgent(options = {}) {
  return new DemoAgent(options)
}

class DemoAgent {
  #stateListeners = new Set()
  #requestListeners = new Set()
  #history
  #state
  #request
  #activeRun
  #runSequence = 0
  #timer
  #delays

  constructor({ seedHistory = true, delays = {} } = {}) {
    this.#delays = Object.freeze({ ...DEFAULT_DELAYS, ...delays })
    this.#history = seedHistory ? structuredClone(SEEDED_HISTORY) : []
    this.#state = freezeSnapshot(seedHistory
      ? {
          status: 'completed', runId: 'demo-seed', step: 1,
          messages: this.#history,
          result: {
            status: 'completed', runId: 'demo-seed',
            content: 'Order 1042 is ready to ship. The current delivery date is Wednesday.', steps: 1,
          },
          contextUsage: { usedTokens: 1860, maxTokens: 120000 }, updatedAt: Date.now(),
        }
      : {
          status: 'idle', step: 0, messages: [],
          contextUsage: { usedTokens: 0, maxTokens: 120000 }, updatedAt: Date.now(),
        })
  }

  get state() {
    return this.#state
  }

  subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('State listener must be a function')
    this.#stateListeners.add(listener)
    callSafely(listener, this.#state)
    return () => { this.#stateListeners.delete(listener) }
  }

  subscribeRequests(listener) {
    if (typeof listener !== 'function') throw new TypeError('Request listener must be a function')
    this.#requestListeners.add(listener)
    if (this.#request) callSafely(listener, this.#request)
    return () => { this.#requestListeners.delete(listener) }
  }

  async send(message) {
    if (typeof message !== 'string' || !message.trim()) throw new TypeError('Message must not be empty')
    if (this.#activeRun) throw new Error('Demo Agent is already running')

    const sequence = ++this.#runSequence
    const runId = `demo-run-${sequence}`
    const run = {
      sequence,
      runId,
      steps: 0,
      messages: [{ role: 'user', content: message }],
      resolve: undefined,
    }
    this.#activeRun = run
    this.#publish({
      status: 'running', runId, step: 0,
      messages: [...this.#history, ...run.messages],
      contextUsage: this.#usage(run.messages),
    })

    return new Promise((resolve) => {
      run.resolve = resolve
      this.#schedule(run, this.#delays.assistant, () => this.#publishAssistant(run))
    })
  }

  respond(requestId, answer) {
    const run = this.#activeRun
    const request = this.#request
    if (!run || !request || request.id !== requestId || typeof answer !== 'string' || !answer.trim()) return false

    this.#request = undefined
    run.messages.push({
      role: 'tool', callId: request.callId, name: 'ask_user',
      content: JSON.stringify({ answer }), isError: false,
    })
    this.#publish({
      status: 'running', runId: run.runId, step: run.steps,
      messages: [...this.#history, ...run.messages],
      contextUsage: this.#usage(run.messages),
    })
    this.#schedule(run, this.#delays.completion, () => this.#complete(run))
    return true
  }

  abort() {
    const run = this.#activeRun
    if (!run) return
    this.#clearTimer()
    this.#request = undefined
    this.#activeRun = undefined
    const result = { status: 'aborted', runId: run.runId, steps: run.steps }
    this.#publish({
      status: 'aborted', runId: run.runId, step: run.steps,
      messages: this.#history, result,
      contextUsage: this.#usage([]),
    })
    run.resolve(result)
  }

  #publishAssistant(run) {
    run.steps = 1
    run.messages.push({
      role: 'assistant', content: 'I found order 1042 and am checking the available delivery window.',
      toolCalls: [{ callId: `demo-call-${run.sequence}-lookup`, name: 'lookup_order', input: { orderId: '1042' } }],
    })
    this.#publish({
      status: 'running', runId: run.runId, step: run.steps,
      messages: [...this.#history, ...run.messages],
      activeTool: { name: 'lookup_order', input: { orderId: '1042' } },
      contextUsage: this.#usage(run.messages),
    })
    this.#schedule(run, this.#delays.tool, () => this.#publishToolResult(run))
  }

  #publishToolResult(run) {
    run.steps = 2
    run.messages.push({
      role: 'tool', callId: `demo-call-${run.sequence}-lookup`, name: 'lookup_order',
      content: JSON.stringify({ availableDate: 'Friday', address: '18 Market Street' }), isError: false,
    })
    this.#publish({
      status: 'running', runId: run.runId, step: run.steps,
      messages: [...this.#history, ...run.messages],
      contextUsage: this.#usage(run.messages),
    })
    this.#schedule(run, this.#delays.question, () => this.#askQuestion(run))
  }

  #askQuestion(run) {
    run.steps = 3
    const callId = `demo-call-${run.sequence}-question`
    const prompt = 'Use 18 Market Street as the shipping address?'
    run.messages.push({
      role: 'assistant', content: null,
      toolCalls: [{ callId, name: 'ask_user', input: { question: prompt } }],
    })
    this.#request = freezeSnapshot({
      type: 'human_input', id: `demo-request-${run.sequence}`, callId,
      runId: run.runId, step: run.steps, prompt,
    })
    this.#publish({
      status: 'waiting_for_input', runId: run.runId, step: run.steps,
      messages: [...this.#history, ...run.messages],
      contextUsage: this.#usage(run.messages),
    })
    for (const listener of this.#requestListeners) callSafely(listener, this.#request)
  }

  #complete(run) {
    const content = 'Order 1042 is scheduled for Friday at 18 Market Street.'
    run.messages.push({ role: 'assistant', content })
    this.#history = [...this.#history, ...run.messages]
    this.#activeRun = undefined
    const result = { status: 'completed', runId: run.runId, content, steps: run.steps }
    this.#publish({
      status: 'completed', runId: run.runId, step: run.steps,
      messages: this.#history, result,
      contextUsage: this.#usage([]),
    })
    run.resolve(result)
  }

  #schedule(run, delay, callback) {
    this.#clearTimer()
    this.#timer = setTimeout(() => {
      this.#timer = undefined
      if (this.#activeRun === run) callback()
    }, delay)
  }

  #clearTimer() {
    if (this.#timer !== undefined) clearTimeout(this.#timer)
    this.#timer = undefined
  }

  #publish(next) {
    this.#state = freezeSnapshot({ ...next, updatedAt: Date.now() })
    for (const listener of this.#stateListeners) callSafely(listener, this.#state)
  }

  #usage(runMessages) {
    return {
      usedTokens: 1860 + this.#history.length * 140 + runMessages.length * 175,
      maxTokens: 120000,
    }
  }
}

function callSafely(listener, value) {
  try { listener(value) } catch { /* Demo views are isolated like Core subscribers. */ }
}

function freezeSnapshot(value) {
  const clone = structuredClone(value)
  return deepFreeze(clone)
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}
