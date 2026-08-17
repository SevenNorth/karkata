---
title: OpenAI-compatible Provider
description: 配置 Chat Completions Adapter、凭据与错误处理
---

# OpenAI-compatible Provider

`@karkata-ai/openai-compatible` 把 OpenAI-compatible Chat Completions 请求、流和工具调用归一化为 Core 契约。

```ts
import { createAgent } from '@karkata-ai/openai-compatible'

const agent = createAgent({
  model: 'your-model',
  baseURL: 'https://your-provider.example/v1',
  apiKey: serverApiKey,
  maxRetries: 2,
  agent: { streaming: {}, humanInput: {} },
})
```

只在受信任的服务端或同源代理中读取 API Key。不要把长期凭据写入静态站、浏览器 bundle、状态、错误或消息。动态 `headers` 可在每次请求前解析短期凭据，但解析失败不会自动标记为可重试。

Adapter 只重试网络错误、429 和 5xx；401、403、普通 4xx、校验错误和无效响应不会重试。所有重试和流读取都接收当前运行的 `AbortSignal`。`transformRequest` 只用于兼容供应商字段，不应记录未脱敏请求。

需要手动装配时可创建 `OpenAICompatibleAdapter` 并作为 `llm` 传给 `Agent`；两种入口使用相同 Runtime。

生产环境的代理、凭据和 SSE 检查见[生产架构](/production/architecture)、[生产配置](/production/configuration)和[部署检查](/production/deployment)。
