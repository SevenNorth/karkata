# Karkata

Karkata is a lightweight, headless agent runtime for TypeScript. It handles model calls, multi-step tool execution, cancellation, state subscriptions, and hot-swappable tools without assuming a DOM or UI framework.

## Workspace

| Package | Purpose |
| --- | --- |
| `@karkata/core` | Agent runtime, normalized messages, state, cancellation, and tool registry |
| `@karkata/openai-compatible` | OpenAI-compatible chat completions adapter |
| `@karkata/javascript` | Optional, explicitly registered unsafe JavaScript execution tool; not a sandbox |

## Example

```ts
import { defineTool } from '@karkata/core'
import { createAgent } from '@karkata/openai-compatible'
import { z } from 'zod'

const getOrderTool = defineTool({
  name: 'get_order',
  description: 'Get an order by ID',
  inputSchema: z.object({ id: z.string() }),
  execute: async ({ id }, { signal }) => {
    const response = await fetch(`/api/orders/${id}`, { signal })
    return response.json()
  },
})

const agent = createAgent({
  model: 'your-model',
  baseURL: 'https://example.com/v1',
  apiKey: 'use-a-short-lived-token-or-proxy',
  agent: {
    tools: [getOrderTool],
    systemPrompt: 'Reply in Chinese and follow the application approval rules.',
    resolveInstructions: async ({ tools, signal }) => {
      const moduleName = getCurrentModuleName()
      const response = await fetch(`/api/agent-instructions?module=${encodeURIComponent(moduleName)}`, { signal })
      return response.ok && tools.length > 0 ? response.text() : undefined
    },
  },
})

const unsubscribe = agent.subscribe((state) => {
  console.log(state.status, state.activeTool)
})

console.log(agent.listToolScopes())
console.log(agent.listTools({ scope: 'global' }))

const result = await agent.send('Find order 123')
unsubscribe()
```

Scopes are user-defined grouping keys. Empty scopes remain discoverable until explicitly removed with `agent.removeToolScope(scope)`; `global` follows the same lifecycle as any other scope.

Every successful tool must explicitly return a model-visible `ToolOutput`: a finite number, string, boolean, null, or a recursively composed array/plain object of those values. Action-only tools should return a minimal confirmation such as `{ success: true }`; tools handling sensitive business data should map internal results to a safe DTO instead of returning them directly. `defineTool()` rejects `void`, `undefined`, and other clearly invalid outputs, while the Runtime retains validation for explicit type bypasses, non-plain objects, and circular values.

Karkata always sends a built-in runtime system prompt. `systemPrompt` adds static application instructions, while `resolveInstructions` can synchronously or asynchronously provide trusted instructions before each model step. These internal instructions are sent only to the model and are not included in `agent.state.messages` or conversation history.

`createAgent()` is the concise OpenAI-compatible entry point. It creates an `OpenAICompatibleAdapter` internally while keeping provider settings separate from Runtime settings under `agent`. Advanced integrations can continue to use `new Agent({ llm: new OpenAICompatibleAdapter(...) })`, and other model protocols can implement the Core `LLMAdapter` contract without changing the Runtime.

Do not embed long-lived model API keys in public browser bundles. Prefer an application proxy, short-lived token, or a custom authenticated `fetch` implementation.

## Development

```bash
npm install
npm run check
```

All runtime behavior is developed with test-driven development. The adopted architecture and contracts are indexed in [design documents](./docs/design/README.md), repository rules are defined in [AGENTS.md](./AGENTS.md), and lightweight or full change processes are documented in [AI workflows](./ai-workflows/README.md).

Useful commands:

```bash
npm test                 # run all tests once
npm run test:watch       # TDD watch mode
npm run test:coverage    # coverage report for shared runtime changes
npm run check            # typecheck, tests, and package builds
```
