import { createAgent } from '@karkata-ai/openai-compatible'
import { createAgentUIStore } from '@karkata-ai/ui'
import { defineKarkataPanel, type KarkataPanelElement } from '@karkata-ai/ui/web-component'

export function mountPanel(serverApiKey: string): KarkataPanelElement {
  const agent = createAgent({
    model: 'your-model',
    baseURL: 'https://your-provider.example/v1',
    apiKey: serverApiKey,
    agent: { streaming: {}, humanInput: {} },
  })
  const store = createAgentUIStore(agent)

  defineKarkataPanel()
  const panel = document.createElement('karkata-panel') as KarkataPanelElement
  panel.store = store
  panel.labels = { send: 'Send', abort: 'Stop' }
  return panel
}
