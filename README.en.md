# Karkata

[Documentation](https://sevennorth.github.io/karkata/en/) | English | [中文](https://github.com/SevenNorth/karkata/blob/main/README.md)

Karkata is a lightweight, headless agent runtime for TypeScript applications. It manages model calls, multi-step tool execution, persistent sessions, cancellation, streaming responses, and Human-in-the-Loop input without binding the runtime to a DOM, UI framework, model provider, or business environment.

## Packages

| Package | Purpose |
| --- | --- |
| `@karkata-ai/core` | Agent lifecycle, normalized messages, tools, state, cancellation, and sessions |
| `@karkata-ai/openai-compatible` | OpenAI-compatible Chat Completions adapter and concise Agent factory |
| `@karkata-ai/javascript` | Explicitly registered, non-sandboxed JavaScript tool for trusted code only |
| `@karkata-ai/ui` | Framework-neutral UI Store and optional Web Component panel |

## Quick Start

```bash
npm install @karkata-ai/core @karkata-ai/openai-compatible zod
```

```ts
import { defineTool } from '@karkata-ai/core'
import { createAgent } from '@karkata-ai/openai-compatible'
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

const agent = createAgent({
  model: 'your-model',
  baseURL: 'https://your-provider.example/v1',
  apiKey: process.env.MODEL_API_KEY,
  agent: {
    tools: [getOrder],
    systemPrompt: 'Reply in English.',
    streaming: {},
    humanInput: {},
  },
})

agent.subscribe((state) => {
  if (state.partialResponse) console.log(state.partialResponse.content)
})

const result = await agent.send('Find order 123')
console.log(result)
```

For the OpenAI-compatible provider, `baseURL` is the only required provider option. `model` is optional: when omitted, the endpoint may choose the model. This is useful when `baseURL` points to an application LLM proxy; the proxy may accept, override, map, or reject a client-provided model.

An Agent instance runs at most one `send()` at a time. Successful runs are committed to the persistent session; failed, aborted, and timed-out runs do not commit incomplete messages. Applications expose environment capabilities and side effects through explicitly registered tools.

## UI

React, Vue, and native views can subscribe to the framework-neutral Store in `@karkata-ai/ui`:

```ts
import { createAgentUIStore } from '@karkata-ai/ui'

const store = createAgentUIStore(agent)
const unsubscribe = store.subscribe(() => render(store.getSnapshot()))

void store.submit('Hello')

unsubscribe()
store.dispose()
```

Browsers can also use the explicit, SSR-safe Web Component entry:

```ts
import { defineKarkataPanel, type KarkataPanelElement } from '@karkata-ai/ui/web-component'

defineKarkataPanel()
const panel = document.querySelector<KarkataPanelElement>('karkata-panel')
if (panel) panel.agent = agent
```

Run the offline UI demo:

```bash
npm run demo:ui
```

## Security Boundaries

- Do not ship long-lived model API keys in public browser bundles. Use an application backend proxy or short-lived token.
- `@karkata-ai/javascript` executes in the host's current Realm. It is not a security sandbox and must only process trusted code.
- A Human-in-the-Loop question is not an authorization boundary. Sensitive tools still need server-side permission checks.
- `AbortSignal` makes the Runtime stop waiting promptly. It cannot guarantee cancellation of side effects in external systems that ignore it.

## Development and Release Verification

Repository development requires Node.js `>=22.18.0` and npm `>=11`. Published packages support Node.js `>=20`; Core and non-browser UI entries remain DOM-free.

```bash
npm install
npm run check
npm run test:release
npm run test:coverage
npm run test:package
npm pack --workspaces --dry-run
```

The adopted design lives in [docs/design](https://github.com/SevenNorth/karkata/tree/main/docs/design), repository collaboration rules live in [AGENTS.md](https://github.com/SevenNorth/karkata/blob/main/AGENTS.md), and the complete release checklist lives in [docs/RELEASING.md](https://github.com/SevenNorth/karkata/blob/main/docs/RELEASING.md). Run the real-provider smoke explicitly with `KARKATA_BASE_URL`, `KARKATA_API_KEY`, `KARKATA_MODEL`, and `npm run test:integration:real`; it is not part of default tests or CI.

## License

[MIT](https://github.com/SevenNorth/karkata/blob/main/LICENSE)
