import { Agent, defineTool, type LLMAdapter } from '@karkata-ai/core'
import { z } from 'zod'

const orderResponseSchema = z.object({ status: z.string() })

const getOrder = defineTool<{ id: string }, { id: string; status: string }>({
  name: 'get_order',
  description: 'Get an order by ID',
  inputSchema: z.object({ id: z.string() }),
  execute: async ({ id }, { signal }) => {
    const response = await fetch(`/api/orders/${encodeURIComponent(id)}`, { signal })
    const order = orderResponseSchema.parse(await response.json())
    return { id, status: order.status }
  },
})

declare const llm: LLMAdapter

export const agent = new Agent({ llm, tools: [getOrder], timeoutMs: 30_000 })
