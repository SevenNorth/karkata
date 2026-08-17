# @karkata-ai/openai-compatible

[文档](https://sevennorth.github.io/karkata/provider/openai-compatible) | [English](https://github.com/SevenNorth/karkata/blob/main/packages/openai-compatible/README.en.md) | 中文

Karkata 的 OpenAI-compatible Chat Completions Adapter，包含便捷的 `createAgent()` 工厂以及可独立传给 Core 的 `OpenAICompatibleAdapter`。

## 安装

```bash
npm install @karkata-ai/core @karkata-ai/openai-compatible
```

## 使用

```ts
import { createAgent } from '@karkata-ai/openai-compatible'

const agent = createAgent({
  model: 'your-model',
  baseURL: 'https://your-provider.example/v1',
  apiKey: process.env.MODEL_API_KEY,
  maxRetries: 2,
  agent: {
    systemPrompt: 'Reply in Chinese.',
    streaming: {},
  },
})

const result = await agent.send('你好')
```

Adapter 规范化文本、Tool Call、Token Usage、SSE 流和常见 HTTP/网络错误。只重试网络错误、HTTP 429 与 HTTP 5xx；鉴权、校验和普通 4xx 不重试。自定义 `headers` 或 `fetch` 可用于短期令牌和应用后端代理。

不要把长期 API Key 放入公开浏览器包。不同服务虽然使用相似的 OpenAI 路径，也可能在流式事件、工具调用或错误体上存在差异；发布前应对目标 Provider 显式运行真实 smoke。

在 Karkata 仓库中设置 `KARKATA_BASE_URL`、`KARKATA_API_KEY`、`KARKATA_MODEL`，然后运行 `npm run test:integration:real`。可选的 `KARKATA_STREAMING=true` 会验证流式路径；命令不会打印密钥或响应正文。

完整配置与 Runtime 说明见 [Karkata 仓库](https://github.com/SevenNorth/karkata)。

## License

[MIT](https://github.com/SevenNorth/karkata/blob/main/LICENSE)
