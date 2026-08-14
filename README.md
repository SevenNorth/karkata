# Karkata

Karkata is a lightweight, headless agent runtime for TypeScript. It handles model calls, multi-step tool execution, cancellation, state subscriptions, and hot-swappable tools without assuming a DOM or UI framework.

## Workspace

| Package | Purpose |
| --- | --- |
| `@karkata/core` | Agent runtime, normalized messages, state, cancellation, and tool registry |
| `@karkata/openai-compatible` | OpenAI-compatible chat completions adapter |
| `@karkata/javascript` | Optional, explicitly registered unsafe JavaScript execution tool; not a sandbox |
| `@karkata/ui` | Optional framework-neutral UI Store and Web Component panel |

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
    contextBudget: {
      maxTokens: 120_000,
      estimateTokens: (request, { signal }) => estimateModelInputTokens(request, { signal }),
      compaction: {
        triggerTokens: 100_000,
        targetTokens: 70_000,
        compactHistory: (history, context) => compactConversationHistory(history, context),
      },
    },
    humanInput: {},
    streaming: {
      stateUpdateIntervalMs: 32,
      maxOutputLength: 200_000,
    },
  },
})

const unsubscribe = agent.subscribe((state) => {
  console.log(state.status, state.activeTool)
  if (state.contextUsage) {
    console.log(`${state.contextUsage.usedTokens} / ${state.contextUsage.maxTokens}`)
  }
  if (state.partialResponse) {
    renderDraft(state.partialResponse.content)
  }
})

const unsubscribeRequests = agent.subscribeRequests((request) => {
  showQuestion(request.prompt).then((answer) => {
    agent.respond(request.id, answer)
  })
})

console.log(agent.listToolScopes())
console.log(agent.listTools({ scope: 'global' }))

const result = await agent.send('Find order 123')
unsubscribe()
unsubscribeRequests()
```

Scopes are user-defined grouping keys. Empty scopes remain discoverable until explicitly removed with `agent.removeToolScope(scope)`; `global` follows the same lifecycle as any other scope.

Every successful tool must explicitly return a model-visible `ToolOutput`: a finite number, string, boolean, null, or a recursively composed array/plain object of those values. Action-only tools should return a minimal confirmation such as `{ success: true }`; tools handling sensitive business data should map internal results to a safe DTO instead of returning them directly. `defineTool()` rejects `void`, `undefined`, and other clearly invalid outputs, while the Runtime retains validation for explicit type bypasses, non-plain objects, and circular values.

Karkata always sends a built-in runtime system prompt. `systemPrompt` adds static application instructions, while `resolveInstructions` can synchronously or asynchronously provide trusted instructions before each model step. These internal instructions are sent only to the model and are not included in `agent.state.messages` or conversation history.

Model failures are exposed as structured `AgentError` values with a stable `code`, safe `message`, `retryable` flag, and optional HTTP `statusCode`. OpenAI-compatible calls distinguish network, authentication, rate-limit, invalid-response, and provider failures; only network failures, HTTP 429, and HTTP 5xx are retried. Provider response bodies, request bodies, authorization data, and original error causes are not copied into `AgentResult` or `AgentState`. Custom adapters can throw the Core `ModelError` class to participate in the same classification contract; unclassified errors remain `MODEL_ERROR` and are not retryable.

Optional `contextBudget` protects each model call before it is sent. The estimator receives the complete frozen request, including system instructions, committed history, current run messages, and tool schemas. `state.contextUsage` exposes only `{ maxTokens, usedTokens }` for UI rendering; `usedTokens` is the latest request estimate, not cumulative API usage. Estimates equal to the limit are allowed, while larger requests fail with `CONTEXT_LIMIT_EXCEEDED` without calling the model or committing the failed run.

Optional `contextBudget.compaction` adds application-controlled history compression. When an estimate exceeds `triggerTokens`, `compactHistory` receives only frozen, successfully committed history plus the current signal and budget metadata. It can remove old complete turns or call a separately configured model to return a summarized `AgentMessage[]`; current run messages and tool schemas cannot be replaced. Karkata validates Tool Call/Result pairing, rebuilds the complete request, and requires the new estimate to be at most `targetTokens`. The candidate history is committed only if the run succeeds. Set the trigger below the provider's hard context limit so a model-based summarizer still has headroom, and keep summaries derived from conversation content at ordinary user-message privilege rather than treating them as trusted system instructions. Karkata does not choose a tokenizer, summarization model, or provider-specific compaction endpoint.

Optional `humanInput: {}` enables Human-in-the-Loop questions. Karkata exposes a reserved `ask_user` tool to the model; when it is called, `state.status` becomes `waiting_for_input` and `subscribeRequests()` publishes a frozen request. The host resumes the same run with `respond(request.id, answer)`. Waiting obeys the run's existing timeout, `abort()`, and `dispose()` semantics, and late or duplicate responses are ignored. This model-initiated question is not an authorization boundary: applications must still enforce permissions for sensitive tools.

Optional `streaming: {}` enables normalized text streaming when the selected Adapter implements `stream()`. `state.partialResponse` contains the cumulative text for the current model step and is published at most once every `stateUpdateIntervalMs` (default `32`; use `0` for every delta). It is a temporary UI projection, never part of `state.messages`, model history, or the final `AgentResult`; completion atomically replaces it with the validated Assistant message. `maxOutputLength` defaults to `200_000` characters and rejects an oversized or malformed stream without committing the current run. Streaming is disabled by default, so existing Adapters continue to use the required `invoke()` path unchanged.

## UI

`@karkata/ui` provides a DOM-free Store for custom React, Vue, or native views. It combines Agent state and Human-in-the-Loop requests into one safe UI snapshot, and `submit()` routes the same composer to either a new message or the current answer:

Run the repository's local demo to try the real Web Component without an API key or external network access:

```bash
npm run demo:ui
```

Open the printed loopback URL (by default `http://127.0.0.1:4173`). The deterministic demo Agent exercises messages, tool status, Human-in-the-Loop responses, abort, reset, and responsive layout. It is an example fixture, not a replacement Runtime or production model integration. Set `PORT` before starting the command to use another port.

```ts
import { createAgentUIStore } from '@karkata/ui'

const store = createAgentUIStore(agent)
const unsubscribe = store.subscribe(() => render(store.getSnapshot()))

form.addEventListener('submit', () => {
  // Each UI event uses the latest composer. A message run may remain pending
  // while a later event routes its answer through respond().
  void store.submit(input.value)
})

unsubscribe()
store.dispose()
```

`AgentState.messages` is the model-context snapshot and may change after history compaction or run rollback. `AgentUIState.items` is the observed, session-scoped display transcript. It preserves interactions observed after Store creation, but it is not a checkpoint format and cannot reconstruct content lost before binding or across a page refresh.

When Core streaming is enabled, the Store projects `partialResponse` directly into `items` as a normal Assistant message. Every message item has `contentStatus: 'complete' | 'streaming' | 'incomplete'`: cumulative updates keep one stable item ID, successful completion upgrades that item in place, and a failed or aborted run retains already-visible text as `incomplete`. `runStatus` remains separate because a complete message from an earlier tool step can belong to a run that later fails.

For a ready-made browser panel, use the explicit, SSR-safe browser entry:

```ts
import { defineKarkataPanel, type KarkataPanelElement } from '@karkata/ui/web-component'

defineKarkataPanel()
const panel = document.querySelector<KarkataPanelElement>('karkata-panel')!
panel.agent = agent

// Tool protocol details are hidden for end users by default.
// Enable them only in a diagnostics-oriented surface.
panel.showTools = false
```

The panel maps Runtime states to natural labels, shows an empty state, renders streaming Assistant items in place, and hides tool entries and active tool names by default. Set `panel.showTools = true` for a diagnostics-oriented view. Retry appears only for retryable failed message runs and starts a new run with the original user message; it never retries Human-in-the-Loop answers or tool calls. All visible labels can be replaced through `panel.labels`.

Assigning `panel.agent` is the convenient ownership mode. For transcript continuity across component detach/reattach, create one Store in the application and assign `panel.store = store`; the application then owns `store.dispose()`. See the [UI interaction contract](./docs/design/Karkata%20UI%20交互契约.md) for React and Vue integration, item semantics, labels, theming, and lifecycle rules.

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
