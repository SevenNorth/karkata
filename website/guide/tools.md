---
title: 工具
description: 定义、注册并安全执行模型工具
---

# 工具

工具是宿主显式提供给 Agent 的能力。输入由 Zod 在运行时校验，输出必须是可序列化且模型可见的 `ToolOutput`。

```ts
import { defineTool } from '@karkata-ai/core'
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

不要直接返回数据库记录、Response、函数或带循环引用的对象。先执行授权，再将外部输入映射为安全 DTO；Runtime 会限制进入模型上下文的序列化长度。

## 动态注册

```ts
const unregister = agent.registerTool(getOrder, { scope: 'orders' })
agent.replaceTool(getOrder, { scope: 'orders' })
console.log(agent.listTools({ scope: 'orders' }))
unregister()
```

工具校验和执行使用同一个注册快照。替换会生成新版本；旧调用返回 `TOOL_CHANGED`，旧的解注册回调也不能删除后续同名注册。工具错误应保持可恢复且不泄漏凭据。

`@karkata-ai/javascript` 的 `createUnsafeJavaScriptTool()` 只适用于完全可信代码，并在宿主当前 Realm 执行。它不是沙箱，Core 不会自动启用它。
