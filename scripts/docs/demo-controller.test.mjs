import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createDemoController } from '../../website/.vitepress/demo-controller.mjs'

describe('documentation demo controller', () => {
  it('registers on mount, replaces scenarios, and disposes the active Agent', async () => {
    const events = []
    const agents = []
    const panel = { agent: null, labels: null }
    const controller = createDemoController({
      async loadPanelModule() {
        events.push('load')
        return { defineKarkataPanel: () => events.push('define') }
      },
      createAgent(options) {
        const agent = {
          options,
          abortCalls: 0,
          abort() { this.abortCalls += 1 },
        }
        agents.push(agent)
        return agent
      },
      labels: { zh: { send: '发送' }, en: { send: 'Send' } },
    })

    assert.deepEqual(events, [])
    await controller.mount(panel, { locale: 'zh', scenario: 'order' })
    assert.deepEqual(events, ['load', 'define'])
    assert.equal(panel.agent, agents[0])
    assert.deepEqual(panel.labels, { send: '发送' })
    assert.deepEqual(agents[0].options, { scenario: 'order', locale: 'zh' })

    controller.reset({ locale: 'en', scenario: 'retryable-error' })
    assert.equal(agents[0].abortCalls, 1)
    assert.equal(panel.agent, agents[1])
    assert.deepEqual(panel.labels, { send: 'Send' })
    assert.deepEqual(agents[1].options, { scenario: 'retryable-error', locale: 'en' })

    controller.dispose()
    controller.dispose()
    assert.equal(agents[1].abortCalls, 1)
    assert.equal(panel.agent, null)
  })

  it('does not bind a late panel module after disposal', async () => {
    let resolveModule
    let createCalls = 0
    const panel = { agent: null, labels: null }
    const controller = createDemoController({
      loadPanelModule: () => new Promise((resolve) => { resolveModule = resolve }),
      createAgent: () => { createCalls += 1; return { abort() {} } },
      labels: { zh: {}, en: {} },
    })

    const mounting = controller.mount(panel, { locale: 'zh', scenario: 'order' })
    controller.dispose()
    resolveModule({ defineKarkataPanel() {} })
    await mounting

    assert.equal(createCalls, 0)
    assert.equal(panel.agent, null)
  })
})
