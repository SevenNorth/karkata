---
title: Quick Start
description: Create your first Karkata Agent
---

# Quick Start

Karkata separates the model protocol from the Agent Runtime. Install these dependencies for an OpenAI-compatible Chat Completions service:

```bash
npm install @karkata/core @karkata/openai-compatible zod
```

## Define a tool

```ts
import { defineTool } from '@karkata/core'
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

A tool must return a serializable, model-visible `ToolOutput`. Enforce server-side authorization and map sensitive results to a safe DTO inside the tool.

## Create an Agent

```ts
import { Agent } from '@karkata/core'
import { OpenAICompatibleAdapter } from '@karkata/openai-compatible'

const llm = new OpenAICompatibleAdapter({
  model: 'your-model',
  baseURL: 'https://your-provider.example/v1',
  apiKey: process.env.MODEL_API_KEY,
})

const agent = new Agent({
  llm,
  tools: [getOrder],
  systemPrompt: 'Reply in English.',
  streaming: {},
})

const result = await agent.send('Find order 1042')
console.log(result)
```

`Agent` depends only on Core's `LLMAdapter` interface. Creating the provider adapter explicitly and injecting it through `llm` also lets you replace it with your own model adapter.

For a shorter OpenAI-compatible setup, use the equivalent convenience factory:

```ts
import { createAgent } from '@karkata/openai-compatible'

const agent = createAgent({
  model: 'your-model',
  baseURL: 'https://your-provider.example/v1',
  apiKey: process.env.MODEL_API_KEY,
  agent: {
    tools: [getOrder],
    systemPrompt: 'Reply in English.',
    streaming: {},
  },
})
```

Internally, `createAgent()` creates the same `OpenAICompatibleAdapter` and passes it to Core as `llm`; both forms use the same Agent Runtime.

One Agent instance executes at most one `send()` at a time. Successful runs commit the persistent session; failed, aborted, and timed-out runs do not commit incomplete messages.

## Subscribe to state

```ts
const unsubscribe = agent.subscribe((state) => {
  if (state.partialResponse) renderDraft(state.partialResponse.content)
  if (state.activeTool) renderToolStatus(state.activeTool.name)
})

// When the session ends
unsubscribe()
await agent.dispose()
```

Continue with [UI Integration](/en/ui/) or review the [Security Boundaries](/en/guide/security).
