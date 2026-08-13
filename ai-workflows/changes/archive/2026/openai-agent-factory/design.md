# 设计：OpenAI Agent 便捷工厂

## 现状分析

`@karkata/core` 的 `AgentConfig.llm` 接受 `LLMAdapter`，`@karkata/openai` 独立导出 `OpenAIAdapter`。该依赖方向是 Provider 依赖 Core，Core 不依赖 Provider，应保持不变。

## 方案

在 `@karkata/openai` 内新增工厂模块：

```ts
export interface OpenAICreateAgentConfig extends OpenAIAdapterConfig {
  agent?: Omit<AgentConfig, 'llm'>
}

export function createAgent(config: OpenAICreateAgentConfig): Agent
```

实现仅执行确定性组合：

```ts
const { agent, ...adapterConfig } = config
return new Agent({ ...agent, llm: new OpenAIAdapter(adapterConfig) })
```

配置示例：

```ts
const agent = createAgent({
  model: 'qwen3.5-plus',
  baseURL: 'https://example.com/v1',
  apiKey: '...',
  agent: {
    tools,
    maxSteps: 20,
  },
})
```

`agent` 使用 `Omit<AgentConfig, 'llm'>`，在 TypeScript 层阻止第二个 Adapter 来源。运行时对象的未知属性由 JavaScript 结构赋值语义处理，但实现展开顺序保证内部创建的 Adapter 最终覆盖潜在的越界 `llm` 字段。

## Runtime 契约

```text
@karkata/core
  Agent + LLMAdapter 契约
          ^
          |
@karkata/openai
  OpenAIAdapter + createAgent
```

Core 的源码和 package dependencies 不变化。工厂返回标准 `Agent`，不引入 Provider 专属子类、生命周期或状态。

## 兼容性与迁移

新增导出，不改变既有 API。高级使用方式继续有效：

```ts
new Agent({ llm: new OpenAIAdapter(config) })
```

## TDD 与验证方案

- Red：从公开入口导入 `createAgent`，验证返回 `Agent`、Runtime 配置生效以及请求使用 Provider 配置。
- Green：新增最小工厂和公开导出。
- Refactor：确认类型声明公开 `OpenAICreateAgentConfig` 且不允许 `agent.llm`。
- 回归：运行 OpenAI 包测试及全仓 `npm run check`。

## 影响范围

- `README.md`
- `docs/design/Karkata无头智能体运行时设计.md`
