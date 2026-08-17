---
title: Vue
description: 通过 shallowRef 将 Store 快照接入 Vue
---

# Vue

Store 快照已经隔离，无需深层代理。使用 `shallowRef` 保存最新引用：

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

Store 由组件创建时，在卸载时同时 `dispose()`；由应用注入的共享 Store 只解除当前订阅。以 `composer.mode`、`contentStatus` 和判别联合字段驱动模板，不直接改写快照。
