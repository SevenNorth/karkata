import { Agent, type LLMAdapter } from '@karkata-ai/core'
import { createUnsafeJavaScriptTool } from '@karkata-ai/javascript'
import { createAgent, OpenAICompatibleAdapter } from '@karkata-ai/openai-compatible'
import { createAgentUIStore, type AgentUIState } from '@karkata-ai/ui'
import { defineKarkataPanel, type KarkataPanelElement } from '@karkata-ai/ui/web-component'

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
