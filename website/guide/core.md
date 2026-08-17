---
title: Core Runtime
description: 创建 Agent、管理会话并读取隔离状态
---

# Core Runtime

`@karkata/core` 负责 Agent 生命周期、会话、工具调度、取消和状态，不绑定模型厂商、DOM 或 Node.js API。

## 创建与运行

```ts
import { Agent, type LLMAdapter } from '@karkata/core'

declare const llm: LLMAdapter
const agent = new Agent({ llm, timeoutMs: 30_000, maxSteps: 12 })
const result = await agent.send('总结当前订单')

if (result.status === 'completed') console.log(result.content)
if (result.status === 'error') console.error(result.error.code)
```

一个实例同一时间只允许一次 `send()`。成功运行会提交完整消息序列并保留为后续会话历史；错误、超时和手动停止不会提交该轮的不完整消息。调用 `clearHistory()` 可清空已提交会话，但运行期间不能调用。

## 状态与生命周期

`agent.subscribe()` 会立即收到隔离快照。监听器抛错不会影响 Runtime；不要修改快照并期待写回 Agent。

```ts
const unsubscribe = agent.subscribe((state) => {
  renderStatus(state.status)
  if (state.activeTool) renderTool(state.activeTool.name)
})

agent.abort()
unsubscribe()
await agent.dispose()
```

`abort()` 首先保证当前 `send()` 及时收敛。`AbortSignal` 会传给模型、工具和用户回调，但不能保证已经发出的外部副作用一定停止。继续阅读 [工具](/guide/tools)、[流式回答](/guide/streaming) 和 [人机协同](/guide/human-input)。
