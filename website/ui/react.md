---
title: React
description: 通过 useSyncExternalStore 订阅 Agent UI Store
---

# React

`AgentUIStore` 提供 React 需要的稳定 `subscribe` 和 `getSnapshot` 接口：

```ts
import type { AgentUIStore } from '@karkata/ui'
import { useSyncExternalStore } from 'react'

export function useAgentState(store: AgentUIStore) {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}
```

在组件外创建 Store，或用 memo 保证实例稳定。提交统一调用 `store.submit(text)`；根据 `state.composer.mode` 展示普通消息或 Human-in-the-Loop 回答。卸载最终所有者时调用 `store.dispose()`，但不要由临时子组件销毁共享 Store。

渲染消息时使用 `item.id` 作为 key，并分别处理 `streaming`、`incomplete` 与 `complete`，不要从文本内容猜测运行状态。
