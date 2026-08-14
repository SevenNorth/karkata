import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createDemoAgent } from './demo-agent.mjs'

const fast = { assistant: 1, tool: 1, question: 1, completion: 1 }

describe('UI demo Agent', () => {
  it('replays state synchronously and completes one run through Human-in-the-Loop', async () => {
    const agent = createDemoAgent({ seedHistory: false, delays: fast })
    const states = []
    let replayed = false
    agent.subscribe((state) => {
      states.push(state)
      replayed = true
    })
    assert.equal(replayed, true)
    assert.equal(states[0].status, 'idle')

    const run = agent.send('Move order 1042 to Friday')
    await waitFor(() => agent.state.status === 'waiting_for_input')

    let replayedRequest
    agent.subscribeRequests((request) => { replayedRequest = request })
    assert.equal(replayedRequest.prompt, 'Use 18 Market Street as the shipping address?')
    assert.equal(replayedRequest.callId, 'demo-call-1-question')
    assert.equal(agent.respond('wrong-request', 'Yes'), false)
    assert.equal(agent.respond(replayedRequest.id, 'Yes, continue'), true)
    assert.equal(agent.respond(replayedRequest.id, 'Duplicate'), false)

    const result = await run
    assert.deepEqual(result, {
      status: 'completed', runId: 'demo-run-1', content: 'Order 1042 is scheduled for Friday at 18 Market Street.', steps: 3,
    })
    assert.equal(agent.state.status, 'completed')
    assert.equal(agent.state.messages.at(-1).content, result.content)
    assert.ok(states.some((state) => state.activeTool?.name === 'lookup_order'))
  })

  it('aborts promptly, rolls back model context, and can start another run', async () => {
    const agent = createDemoAgent({ seedHistory: false, delays: { ...fast, assistant: 50 } })
    const first = agent.send('First request')
    assert.equal(agent.state.status, 'running')
    agent.abort()

    assert.deepEqual(await first, { status: 'aborted', runId: 'demo-run-1', steps: 0 })
    assert.equal(agent.state.status, 'aborted')
    assert.deepEqual(agent.state.messages, [])

    const second = agent.send('Second request')
    await waitFor(() => agent.state.status === 'waiting_for_input')
    let request
    const unsubscribe = agent.subscribeRequests((value) => { request = value })
    assert.equal(request.runId, 'demo-run-2')
    assert.equal(agent.respond(request.id, 'Continue'), true)
    assert.equal((await second).status, 'completed')
    unsubscribe()
  })

  it('rejects concurrent sends and isolates listener failures', async () => {
    const agent = createDemoAgent({ seedHistory: false, delays: fast })
    agent.subscribe(() => { throw new Error('view failed') })
    const run = agent.send('Start')
    await assert.rejects(agent.send('Duplicate'), /already running/)
    await waitFor(() => agent.state.status === 'waiting_for_input')
    let request
    agent.subscribeRequests((value) => { request = value })
    assert.equal(agent.respond(request.id, 'Continue'), true)
    assert.equal((await run).status, 'completed')
  })
})

async function waitFor(predicate, timeoutMs = 1000) {
  const deadline = Date.now() + timeoutMs
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('Timed out waiting for demo state')
    await new Promise((resolve) => setTimeout(resolve, 1))
  }
}
