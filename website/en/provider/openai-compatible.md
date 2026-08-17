---
title: OpenAI-compatible Provider
description: Configure the Chat Completions Adapter, credentials, and errors
---

# OpenAI-compatible Provider

`@karkata-ai/openai-compatible` normalizes OpenAI-compatible Chat Completions requests, streams, and tool calls into the Core contract.

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

Read API keys only in a trusted server or same-origin proxy. Never place long-lived credentials in a static site, browser bundle, state, error, or message. Dynamic `headers` can resolve short-lived credentials per request, but a header resolver failure is not automatically retryable.

The Adapter retries network errors, 429, and 5xx only. It does not retry 401, 403, ordinary 4xx, validation failures, or invalid responses. Retries and stream reads receive the current run's `AbortSignal`. Use `transformRequest` only for vendor field compatibility and never log an unredacted request.

For manual assembly, create `OpenAICompatibleAdapter` and pass it to `Agent` as `llm`; both entry points use the same Runtime.
