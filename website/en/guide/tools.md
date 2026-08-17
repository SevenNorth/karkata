---
title: Tools
description: Define, register, and execute model tools safely
---

# Tools

Tools are capabilities explicitly supplied by the host. Zod validates input at runtime, and output must be a serializable, model-visible `ToolOutput`.

```ts
import { defineTool } from '@karkata/core'
import { z } from 'zod'

const orderSchema = z.object({ status: z.string() })
const getOrder = defineTool<{ id: string }, { id: string; status: string }>({
  name: 'get_order',
  description: 'Get an order by ID',
  inputSchema: z.object({ id: z.string() }),
  execute: async ({ id }, { signal }) => {
    const response = await fetch(`/api/orders/${encodeURIComponent(id)}`, { signal })
    const order = orderSchema.parse(await response.json())
    return { id, status: order.status }
  },
})
```

Do not return database records, Response objects, functions, or cyclic structures directly. Authorize first, then map external input to a safe DTO. The Runtime limits serialized tool output before it enters model context.

## Dynamic registration

```ts
const unregister = agent.registerTool(getOrder, { scope: 'orders' })
agent.replaceTool(getOrder, { scope: 'orders' })
console.log(agent.listTools({ scope: 'orders' }))
unregister()
```

Validation and execution use the same registration snapshot. Replacement creates a new version; an old call returns `TOOL_CHANGED`, and an old unregister callback cannot remove a later registration with the same name. Tool errors should remain actionable without exposing credentials.

`createUnsafeJavaScriptTool()` from `@karkata/javascript` runs only explicitly registered, fully trusted code in the host's current Realm. It is not a sandbox and Core never enables it automatically.
