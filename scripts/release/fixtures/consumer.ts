import { Agent, type LLMAdapter } from '@karkata/core'
import { createUnsafeJavaScriptTool } from '@karkata/javascript'
import { createAgent, OpenAICompatibleAdapter } from '@karkata/openai-compatible'
import { createAgentUIStore, type AgentUIState } from '@karkata/ui'
import { defineKarkataPanel, type KarkataPanelElement } from '@karkata/ui/web-component'

const llm: LLMAdapter = {
  async invoke(_request, { signal }) {
    signal.throwIfAborted()
    return { message: { role: 'assistant', content: 'typed' } }
  },
}
const agent = new Agent({ llm })
const configuredAgent = createAgent({ model: 'test', baseURL: 'http://127.0.0.1' })
const adapter: LLMAdapter = new OpenAICompatibleAdapter({ model: 'test', baseURL: 'http://127.0.0.1' })
const javascriptTool = createUnsafeJavaScriptTool()
const store = createAgentUIStore(agent)
const snapshot: Readonly<AgentUIState> = store.getSnapshot()
const definePanel: typeof defineKarkataPanel = defineKarkataPanel
let panel: KarkataPanelElement | undefined

void configuredAgent
void adapter
void javascriptTool
void snapshot
void definePanel
void panel
