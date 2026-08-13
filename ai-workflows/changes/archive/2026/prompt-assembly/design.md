# 技术设计：增加默认提示词与动态指导组装

## 现状分析

已阅读 Core Agent、消息类型、错误、取消原语和测试，以及 OpenAI Adapter 和三份相关设计协议。当前构造函数把 `systemPrompt` 推入 `#history`，每步直接传递 `history + runMessages`；错误 catch 将所有非取消异常归类为 `MODEL_ERROR`。`awaitWithAbort` 已可包装忽略 signal 的用户 Promise。

## 方案

公开契约：

```ts
export interface InstructionResolverContext {
  readonly runId: string
  readonly step: number
  readonly tools: readonly RegisteredToolInfo[]
  readonly signal: AbortSignal
}

export type InstructionResolver = (
  context: InstructionResolverContext,
) => string | null | undefined | Promise<string | null | undefined>

export interface AgentConfig {
  systemPrompt?: string
  resolveInstructions?: InstructionResolver
  maxInstructionsLength?: number
}
```

Core 内部新增 Prompt Assembler。每步先取得 ToolSnapshot，从该快照建立冻结的工具信息，然后调用 Resolver；对非字符串返回值、异常和最终指导长度分类处理。组装一条临时 SystemMessage：默认规则始终存在，静态与动态非空内容分别放入明确分隔段。随后使用同一 ToolSnapshot 生成 LLM tools。

调用顺序：

```text
snapshot tools
  -> resolveInstructions(frozen context)
  -> validate and assemble one system message
  -> invoke LLM(system + committedHistory + runMessages, same snapshot tools)
  -> validate registrationId before tool execution
```

Resolver 调用由 `awaitWithAbort()` 包装。Agent 在 catch 中通过内部阶段标记把 Resolver/组装错误映射到指令错误码，LLM 调用错误仍为 `MODEL_ERROR`。指导失败丢弃本轮 `runMessages`，不调用 LLM。

## 影响范围

| 包或区域 | 文件 | 变更 |
| --- | --- | --- |
| core prompt | `packages/core/src/prompt.ts` | 默认提示词、运行时校验和组装 |
| core types | `packages/core/src/types.ts` | Resolver、上下文、配置和错误码 |
| core agent | `packages/core/src/Agent.ts` | 每步动态组装、取消和错误分类 |
| core tests | `packages/core/src/Agent.test.ts`、`prompt.test.ts` | 请求、历史、Resolver 和边界测试 |
| docs | `README.md`、`docs/design/*` | 配置示例与 Prompt 契约 |

## Runtime 契约

- 默认提示词始终存在，无法通过 `systemPrompt` 替换或清空。
- `systemPrompt` 在构造后静态不变，作为应用级可信增强。
- Resolver 每次 LLM 调用前执行一次，返回内容只作用于当次请求。
- Resolver tools 只包含当前非空工具投影；空 scope 不单独传入，可由工具投影推导相关 scope。
- Resolver 上下文对象、tools 数组和工具信息对象冻结。
- 同一步 Resolver 和 LLM 使用同一 ToolSnapshot。
- 最终静态与动态增强总长度受 `maxInstructionsLength` 限制；默认值 20,000 字符。默认 Runtime 提示词不计入此额度。
- `null`、`undefined` 和空白动态指导视为无动态指导；其他非字符串值为错误。
- system 消息不进入 committedHistory、runMessages 或 AgentState。
- Resolver 失败不调用模型，运行结果为 error，错误码独立于模型错误。

## 兼容性与迁移

Node 与浏览器仅使用标准 Promise、AbortSignal 和 Object.freeze。既有 `systemPrompt` 仍有效，但从“唯一且可观察的历史 system 消息”变为“默认规则后的静态增强”；应用若依赖 `state.messages` 展示 system 消息需要迁移。OpenAI Adapter 已支持 system 消息，无需 Provider 变化。

## TDD 与验证方案

1. Red：测试默认+静态+动态组装、同步/异步与每步重算、历史隔离、工具快照一致、取消收敛、无效值、异常和长度限制。
2. Green：实现公开类型、Prompt Assembler 和 Agent 主循环集成。
3. Refactor：提取错误类/阶段映射，保持 Agent 主循环可读，冻结 Resolver 输入。
4. 验证：Core 聚焦测试、clean typecheck、全仓 check、覆盖率、干净构建与打包预检、声明扫描、change 和 Git 检查。
