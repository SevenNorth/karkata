---
title: Core Runtime
description: Create an Agent, manage its session, and read isolated state
---

# Core Runtime

`@karkata/core` owns the Agent lifecycle, sessions, tool dispatch, cancellation, and state. It does not depend on a model vendor, the DOM, or Node.js APIs.

## Create and run

```ts
import { Agent, type LLMAdapter } from '@karkata/core'

declare const llm: LLMAdapter
const agent = new Agent({ llm, timeoutMs: 30_000, maxSteps: 12 })
const result = await agent.send('Summarize the current order')

if (result.status === 'completed') console.log(result.content)
if (result.status === 'error') console.error(result.error.code)
```

An instance permits only one active `send()`. A successful run commits its complete message sequence as history for the next turn. Errors, timeouts, and manual aborts do not commit the incomplete turn. `clearHistory()` removes committed history and cannot run during an active turn.

## State and lifecycle

`agent.subscribe()` immediately receives an isolated snapshot. A listener exception cannot affect the Runtime, and mutating a snapshot does not write back to the Agent.

```ts
const unsubscribe = agent.subscribe((state) => {
  renderStatus(state.status)
  if (state.activeTool) renderTool(state.activeTool.name)
})

agent.abort()
unsubscribe()
await agent.dispose()
```

`abort()` first guarantees that the current `send()` settles promptly. The Runtime passes its `AbortSignal` to model, tool, and user callbacks, but cannot guarantee that an external side effect already in flight will stop. Continue with [Tools](/en/guide/tools), [Streaming](/en/guide/streaming), and [Human Input](/en/guide/human-input).
