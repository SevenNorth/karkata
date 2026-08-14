import {
  Agent,
  type AgentState,
  type LLMAdapter,
  type LLMResponse,
  type LLMStreamEvent,
} from '../src/index.js'

const finalResponse: LLMResponse = {
  message: { role: 'assistant', content: 'Hello' },
}

const adapter = {
  invoke: async () => finalResponse,
  stream: () => (async function* (): AsyncGenerator<LLMStreamEvent, LLMResponse, void> {
    yield { type: 'text_delta', delta: 'Hello' }
    return finalResponse
  })(),
} satisfies LLMAdapter

const agent = new Agent({
  llm: adapter,
  streaming: { stateUpdateIntervalMs: 32, maxOutputLength: 10_000 },
})

const state: Readonly<AgentState> = agent.state
const partialContent: string | undefined = state.partialResponse?.content
void partialContent
