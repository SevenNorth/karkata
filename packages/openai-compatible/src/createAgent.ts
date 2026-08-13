import { Agent, type AgentConfig } from '@karkata/core'
import { OpenAICompatibleAdapter, type OpenAICompatibleAdapterConfig } from './OpenAICompatibleAdapter.js'

export interface OpenAICompatibleCreateAgentConfig extends OpenAICompatibleAdapterConfig {
  agent?: Omit<AgentConfig, 'llm'>
}

export function createAgent(config: OpenAICompatibleCreateAgentConfig): Agent {
  const { agent, ...adapterConfig } = config
  return new Agent({ ...agent, llm: new OpenAICompatibleAdapter(adapterConfig) })
}
