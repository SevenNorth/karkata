---
title: React
description: Subscribe to Agent UI Store with useSyncExternalStore
---

# React

`AgentUIStore` exposes the stable `subscribe` and `getSnapshot` functions React expects:

```ts
import type { AgentUIStore } from '@karkata-ai/ui'
import { useSyncExternalStore } from 'react'

export function useAgentState(store: AgentUIStore) {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}
```

Create the Store outside the component or memoize it so the instance remains stable. Submit through `store.submit(text)` and use `state.composer.mode` to present a normal message or a Human-in-the-Loop answer. The final owner calls `store.dispose()` on unmount; a temporary child must not dispose a shared Store.

Use `item.id` as the render key and handle `streaming`, `incomplete`, and `complete` separately instead of inferring run state from content.
