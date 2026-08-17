import type { Agent } from '@karkata-ai/core'

export function observeAgent(agent: Agent): () => void {
  const unsubscribeState = agent.subscribe((state) => {
    if (state.partialResponse) console.log(state.partialResponse.content)
  })
  const unsubscribeRequests = agent.subscribeRequests((request) => {
    if (request.type === 'human_input') agent.respond(request.id, 'Approved by the user')
  })

  return () => {
    unsubscribeState()
    unsubscribeRequests()
  }
}
