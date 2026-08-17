---
title: 快速开始
description: 创建第一个 Karkata Agent
---

# 快速开始

Karkata 把模型协议与 Agent Runtime 分开。使用 OpenAI-compatible Chat Completions 服务时，安装以下依赖：

```bash
npm install @karkata-ai/core @karkata-ai/openai-compatible zod
```

## 创建工具

```ts
import { defineTool } from '@karkata-ai/core'
import { z } from 'zod'

const getOrder = defineTool({
  name: 'get_order',
  description: 'Get an order by ID',
  inputSchema: z.object({ id: z.string() }),
  execute: async ({ id }, { signal }) => {
    const response = await fetch(`/api/orders/${encodeURIComponent(id)}`, { signal })
    return response.json()
  },
})
```

工具返回值必须是可序列化、模型可见的 `ToolOutput`。涉及权限和敏感数据时，应在工具内部执行服务端授权并映射安全 DTO。

## 创建 Agent

```ts
import { Agent } from '@karkata-ai/core'
import { OpenAICompatibleAdapter } from '@karkata-ai/openai-compatible'

const llm = new OpenAICompatibleAdapter({
  model: 'your-model',
  baseURL: 'https://your-provider.example/v1',
  apiKey: process.env.MODEL_API_KEY,
})

const agent = new Agent({
  llm,
  tools: [getOrder],
  systemPrompt: 'Reply in Chinese.',
  streaming: {},
})

const result = await agent.send('查询订单 1042')
console.log(result)
```

`Agent` 只依赖 Core 定义的 `LLMAdapter` 接口。这里手动创建 Provider Adapter 并通过 `llm` 注入，因此也可以替换为你自己的模型适配器。

如果只需要快速接入 OpenAI-compatible 服务，也可以使用等价的便捷工厂：

```ts
import { createAgent } from '@karkata-ai/openai-compatible'

const agent = createAgent({
  model: 'your-model',
  baseURL: 'https://your-provider.example/v1',
  apiKey: process.env.MODEL_API_KEY,
  agent: {
    tools: [getOrder],
    systemPrompt: 'Reply in Chinese.',
    streaming: {},
  },
})
```

`createAgent()` 内部同样创建 `OpenAICompatibleAdapter` 并将其作为 `llm` 传给 Core；两种写法使用的是同一个 Agent Runtime。

一个 Agent 实例同一时间最多执行一次 `send()`。成功运行提交持续会话；失败、中断和超时不会提交不完整消息。

## 订阅状态

```ts
const unsubscribe = agent.subscribe((state) => {
  if (state.partialResponse) renderDraft(state.partialResponse.content)
  if (state.activeTool) renderToolStatus(state.activeTool.name)
})

// 会话结束时
unsubscribe()
await agent.dispose()
```

下一步阅读 [UI 集成](/ui/) 或先确认 [安全边界](/guide/security)。
