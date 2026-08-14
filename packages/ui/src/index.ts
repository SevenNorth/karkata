export { AgentUIStore } from './AgentUIStore.js'
export type * from './types.js'

import { AgentUIStore } from './AgentUIStore.js'
import type { AgentUIAdapter, AgentUIStore as AgentUIStoreContract } from './types.js'

export function createAgentUIStore(agent: AgentUIAdapter): AgentUIStoreContract {
  return new AgentUIStore(agent)
}
