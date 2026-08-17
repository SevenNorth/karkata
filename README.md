# Karkata

[文档](https://sevennorth.github.io/karkata/) | [English](https://github.com/SevenNorth/karkata/blob/main/README.en.md) | 中文

Karkata 是面向 TypeScript 应用的轻量 Headless Agent Runtime。它管理模型调用、多步工具执行、持续会话、取消、流式回答和 Human-in-the-Loop，但不绑定 DOM、UI 框架、模型厂商或业务环境。

## 包

| 包 | 用途 |
| --- | --- |
| `@karkata/core` | Agent 生命周期、规范化消息、工具、状态、取消和会话 |
| `@karkata/openai-compatible` | OpenAI-compatible Chat Completions Adapter 与便捷 Agent 工厂 |
| `@karkata/javascript` | 显式注册、仅适用于可信代码的非沙箱 JavaScript 工具 |
| `@karkata/ui` | 框架无关 UI Store 与可选 Web Component 面板 |

## 快速开始

```bash
npm install @karkata/core @karkata/openai-compatible zod
```

```ts
import { defineTool } from '@karkata/core'
import { createAgent } from '@karkata/openai-compatible'
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
    systemPrompt: 'Reply in Chinese.',
    streaming: {},
    humanInput: {},
  },
})

agent.subscribe((state) => {
  if (state.partialResponse) console.log(state.partialResponse.content)
})

const result = await agent.send('查询订单 123')
console.log(result)
```

每个 Agent 实例同一时间最多运行一次 `send()`。成功运行会提交到持续会话；失败、中断和超时不会提交不完整消息。环境能力和副作用均由应用显式注册工具提供。

## UI

`@karkata/ui` 的 Store 可以被 React、Vue 或原生视图订阅：

```ts
import { createAgentUIStore } from '@karkata/ui'

const store = createAgentUIStore(agent)
const unsubscribe = store.subscribe(() => render(store.getSnapshot()))

void store.submit('你好')

unsubscribe()
store.dispose()
```

浏览器中也可以使用显式、SSR-safe 的 Web Component 入口：

```ts
import { defineKarkataPanel, type KarkataPanelElement } from '@karkata/ui/web-component'

defineKarkataPanel()
const panel = document.querySelector<KarkataPanelElement>('karkata-panel')
if (panel) panel.agent = agent
```

运行离线 UI 演示：

```bash
npm run demo:ui
```

## 安全边界

- 不要把长期模型 API Key 放入公开浏览器包；使用应用后端代理或短期令牌。
- `@karkata/javascript` 在宿主当前 Realm 执行代码，不是安全沙箱，只能处理可信代码。
- Human-in-the-Loop 问题不是授权边界；敏感工具仍必须在服务端检查权限。
- `AbortSignal` 保证 Runtime 及时停止等待，不保证不支持取消的外部系统一定停止副作用。

## 开发与发布验证

要求 Node.js `>=22.18.0` 和 npm `>=11` 进行仓库开发。发布包支持 Node.js `>=20`，Core 与 UI 的非浏览器入口保持 DOM-free。

```bash
npm install
npm run check
npm run test:release
npm run test:coverage
npm run test:package
npm pack --workspaces --dry-run
```

设计基线位于 [docs/design](https://github.com/SevenNorth/karkata/tree/main/docs/design)，协作流程见 [AGENTS.md](https://github.com/SevenNorth/karkata/blob/main/AGENTS.md)，完整发布步骤见 [docs/RELEASING.md](https://github.com/SevenNorth/karkata/blob/main/docs/RELEASING.md)。真实 Provider smoke 使用 `KARKATA_BASE_URL`、`KARKATA_API_KEY` 和 `KARKATA_MODEL` 显式运行 `npm run test:integration:real`，不进入默认测试或 CI。

## License

[MIT](https://github.com/SevenNorth/karkata/blob/main/LICENSE)
