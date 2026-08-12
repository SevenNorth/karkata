# Karkata

Karkata is a lightweight, headless agent runtime for TypeScript. It handles model calls, multi-step tool execution, cancellation, state subscriptions, and hot-swappable tools without assuming a DOM or UI framework.

## Workspace

| Package | Purpose |
| --- | --- |
| `@karkata/core` | Agent runtime, normalized messages, state, cancellation, and tool registry |
| `@karkata/openai` | OpenAI-compatible chat completions adapter |
| `@karkata/javascript` | Optional, explicitly registered JavaScript execution tool |

## Example

```ts
import { Agent, defineTool } from '@karkata/core'
import { OpenAIAdapter } from '@karkata/openai'
import { z } from 'zod'

const agent = new Agent({
  llm: new OpenAIAdapter({
    model: 'your-model',
    baseURL: 'https://example.com/v1',
    apiKey: 'use-a-short-lived-token-or-proxy',
  }),
})

agent.registerTool(defineTool({
  name: 'get_order',
  description: 'Get an order by ID',
  inputSchema: z.object({ id: z.string() }),
  execute: async ({ id }, { signal }) => {
    const response = await fetch(`/api/orders/${id}`, { signal })
    return response.json()
  },
}))

const unsubscribe = agent.subscribe((state) => {
  console.log(state.status, state.activeTool)
})

const result = await agent.send('Find order 123')
unsubscribe()
```

Do not embed long-lived model API keys in public browser bundles. Prefer an application proxy, short-lived token, or a custom authenticated `fetch` implementation.

## Development

```bash
npm install
npm run check
```
