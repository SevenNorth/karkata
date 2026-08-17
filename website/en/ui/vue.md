---
title: Vue
description: Connect Store snapshots to Vue with shallowRef
---

# Vue

Store snapshots are already isolated and do not need deep proxies. Keep the latest reference in a `shallowRef`:

```ts
import type { AgentUIStore } from '@karkata-ai/ui'
import { onUnmounted, shallowRef } from 'vue'

export function useAgentState(store: AgentUIStore) {
  const state = shallowRef(store.getSnapshot())
  const unsubscribe = store.subscribe(() => { state.value = store.getSnapshot() })
  onUnmounted(unsubscribe)
  return state
}
```

When the component creates the Store, also call `dispose()` on unmount. For an application-owned shared Store, remove only this subscription. Drive the template from `composer.mode`, `contentStatus`, and discriminated fields, and never mutate snapshots directly.
