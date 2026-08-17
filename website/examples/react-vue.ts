import type { AgentUIStore } from '@karkata/ui'
import { useSyncExternalStore } from 'react'
import { onUnmounted, shallowRef } from 'vue'

export function useAgentState(store: AgentUIStore) {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}

export function useAgentStateForVue(store: AgentUIStore) {
  const state = shallowRef(store.getSnapshot())
  const unsubscribe = store.subscribe(() => { state.value = store.getSnapshot() })
  onUnmounted(unsubscribe)
  return state
}
