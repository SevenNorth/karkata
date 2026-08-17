# @karkata/core

[文档](https://sevennorth.github.io/karkata/guide/core) | [English](https://github.com/SevenNorth/karkata/blob/main/packages/core/README.en.md) | 中文

Karkata 的框架无关 Agent Runtime。它提供模型循环、规范化消息、工具注册、持续会话、取消与超时、流式状态和 Human-in-the-Loop 协议，不依赖 DOM 或特定模型厂商。

## 安装

```bash
npm install @karkata/core zod
```

## 使用

```ts
import { Agent, defineTool, type LLMAdapter } from '@karkata/core'
import { z } from 'zod'

const llm: LLMAdapter = {
  async invoke(_request, { signal }) {
    signal.throwIfAborted()
    return { message: { role: 'assistant', content: '完成' } }
  },
}

const ping = defineTool({
  name: 'ping',
  description: 'Return a visible confirmation',
  inputSchema: z.object({ value: z.string() }),
  execute: ({ value }) => ({ value }),
})

const agent = new Agent({ llm, tools: [ping], timeoutMs: 30_000 })
const result = await agent.send('开始')
```

`LLMAdapter` 负责 Provider 协议；使用 OpenAI-compatible 服务时可以直接安装 `@karkata/openai-compatible`。工具输出必须是可序列化、模型可见的 `ToolOutput`。同一 Agent 实例一次只运行一个 `send()`，成功运行提交会话，失败、中断和超时运行回滚。

状态通过 `subscribe()` 读取，Human-in-the-Loop 问题通过 `subscribeRequests()` 接收并使用 `respond()` 回答。启用 `streaming` 后，`state.partialResponse` 只用于临时 UI 投影，不写入模型历史。

完整设计和 API 示例见 [Karkata 仓库](https://github.com/SevenNorth/karkata)。

## License

[MIT](https://github.com/SevenNorth/karkata/blob/main/LICENSE)
