export function createDemoController({ loadPanelModule, createAgent, labels }) {
  if (typeof loadPanelModule !== 'function' || typeof createAgent !== 'function') {
    throw new TypeError('Demo controller requires panel loader and Agent factory')
  }
  let panel = null
  let agent = null
  let disposed = false

  return Object.freeze({
    async mount(target, options) {
      if (disposed) return
      panel = target
      const { defineKarkataPanel } = await loadPanelModule()
      if (disposed) return
      defineKarkataPanel()
      bind(options)
    },
    reset(options) {
      if (disposed || panel === null) return false
      stopAgent()
      bind(options)
      return true
    },
    dispose() {
      if (disposed) return
      disposed = true
      stopAgent()
      if (panel !== null) panel.agent = null
      panel = null
    },
  })

  function bind({ locale, scenario }) {
    const localizedLabels = labels[locale]
    if (!localizedLabels) throw new TypeError(`Unknown demo locale: ${locale}`)
    panel.labels = localizedLabels
    agent = createAgent({ scenario, locale })
    panel.agent = agent
  }

  function stopAgent() {
    if (agent === null) return
    agent.abort()
    agent = null
  }
}
