# 技术设计：增加流式回答基础

## 现状分析

`packages/core/src/types.ts` 中 `LLMAdapter` 只有 `invoke()`，`Agent.send()` 在每步等待完整 `LLMResponse` 后才把 Assistant 消息加入 `#runMessages`。`AgentState.messages` 是将来可进入模型上下文的结构完整消息，失败与中止会回滚本轮。`awaitWithAbort()`、`#ensureCurrent()` 和 `#finish()` 已提供取消竞争、runId 门禁和原子清理基础。

`OpenAICompatibleAdapter.invoke()` 只发送 JSON 非流式请求，通过 Zod 一次校验完整响应。它已有请求序列化、动态 headers、HTTP/网络错误分类、指数延迟重试和 AbortSignal 传递，流式路径应复用这些边界。

`AgentUIStore` 以消息数量处理追加式运行消息，不会消费独立的部分回答。将 UI 同时纳入本 change 会跨 Core、Provider、Store 和 Web Component，因此按仓库大型变更规则拆分。

## 方案

### 规范化 Adapter 协议

Core 新增：

```ts
export type LLMStreamEvent =
  { readonly type: 'text_delta'; readonly delta: string }

export interface LLMStream
  extends AsyncIterable<LLMStreamEvent>, AsyncIterator<LLMStreamEvent, LLMResponse, void> {}

export interface LLMAdapter {
  invoke(request: LLMRequest, options: { signal: AbortSignal }): Promise<LLMResponse>
  stream?(request: LLMRequest, options: { signal: AbortSignal }): LLMStream
}
```

iterator 只 yield `text_delta`，并在 `done: true` 时通过 iterator result 的 `value` 返回完整 `LLMResponse`。这使最终响应天然与迭代结束绑定，Core 不需要在收到终止事件后额外调用一次可能永不收敛的 `next()`。

`text_delta` 只携带用户可见 Assistant 文本增量。如果出现文本增量，累积文本必须与最终 `message.content ?? ''` 一致。空/非字符串 delta、缺少有效完成返回值和文本不一致都是无效模型响应。Tool Call 只在最终 response 中暴露，Core 不处理 Provider 分片。

### Agent 状态

`AgentConfig.streaming?: AgentStreamingConfig` 默认关闭。传入 `{}` 时开启并使用默认值；构造器要求 `llm.stream` 存在，否则抛 `TypeError`。这保证既有 Adapter 不受影响，也为状态限频和输出上限留出稳定配置空间。

```ts
export interface AgentStreamingConfig {
  readonly stateUpdateIntervalMs?: number // 默认 32，0 表示每个 delta 都发布
  readonly maxOutputLength?: number       // 默认 200_000 字符
}
```

两个值均必须是非负有限整数，`maxOutputLength` 必须大于 `0`。上限仅约束启用流式时的累积文本和最终响应文本；存量非流式响应限制若需统一，应作为独立契约变更，不在本 change 偷渡默认行为。

```ts
export interface AgentPartialResponse {
  readonly runId: string
  readonly step: number
  readonly content: string
}
```

`AgentState.partialResponse?` 只是当前步骤的 UI 投影，不属于 `messages`、`#runMessages` 或历史。Core 内部使用片段数组累积，按 `stateUpdateIntervalMs` 上限频率生成累计内容并发布快照，避免每个 token 都克隆完整历史。首个非空 delta 立即发布，之后采用 leading + trailing 限频；最终响应与最新消息/状态在同一次 commit 中替换 partial，不产生空白闪烁。

累计字符数超过 `maxOutputLength` 时立即产生不可重试的 `MODEL_INVALID_RESPONSE`，安全消息为 `Model response exceeded the configured streaming output limit`。每次模型步骤开始、完整 response 验证后、失败、中止、超时、`clearHistory()` 和 `dispose()` 时清理 partial 与未触发的状态更新定时器。最终 response 仍按现有逻辑一次性加入 `#runMessages`。

Core 使用显式 async iterator 逐次调用 `next()`，每次都经 `awaitWithAbort()` 竞争当前信号并在处理 iterator result 前执行 `#ensureCurrent()`。终止或失败时 best-effort 调用 `iterator.return?.()`，对同步 throw 和 Promise rejection 都执行吞掉处理，且绝不 await 清理结果；`send()` 及时收敛只依赖 Abort 竞争和 runId 门禁。

### OpenAI-compatible SSE

Adapter 共享非流式路径的 body/header/HTTP 组装，流式 body 增加 `stream: true`。使用小型、标准兼容的 SSE parser 处理 CRLF、多 data 行和跨 chunk 边界，而不以 `split('\n\n')` 自行拼接协议。

Provider choice index `0` 的 `delta.content` 立即归一化为 `text_delta`，其他 choice 与现有非流式路径一样不进入结果。`delta.tool_calls` 按 tool index 累积 id/name/arguments，结束时才 JSON parse 并生成 Tool Call。

`finish_reason` 只记录 choice 已完成，不立即结束迭代，以便继续接收后续 usage chunk。收到 `[DONE]` 后以 async generator 的 return value 返回最终 `LLMResponse`；为兼容部分 Provider，仅当已看到合法 `finish_reason` 时才接受 EOF 作为结束。不可解析数据、无 `[DONE]` 且无 `finish_reason`、或不完整 Tool Call 归类为 `MODEL_INVALID_RESPONSE`。

建连、headers 和 HTTP 错误在返回响应体前沿用 `maxRetries`。一旦开始读取成功 HTTP 响应体，流中错误可保留 `retryable` 分类供上层手动重试，但 Adapter 不再自动重发，避免已发布 delta 重复。

不采用“`invoke()` 返回 Promise 或 AsyncIterable 联合”，因为它会破坏现有 Adapter 和调用方类型。不把半成品 AssistantMessage 放入 `messages`，因为该集合是可重用的模型上下文，必须持续满足消息与 Tool Call 完整性。

## 影响范围

| 包或区域 | 文件 | 变更 |
| --- | --- | --- |
| Core 公开类型 | `packages/core/src/types.ts` | stream iterator、Adapter 可选方法、config 与 partial state |
| Core 主循环 | `packages/core/src/Agent.ts` | 显式流式路径、校验、取消和清理 |
| Core 测试 | `packages/core/src/Agent.test.ts`、`packages/core/src/type-tests.ts` | 状态、原子性、类型与竞态契约 |
| Provider | `packages/openai-compatible/src/OpenAICompatibleAdapter.ts` | SSE 请求、解析、Tool Call 组装与错误归一化 |
| Provider 测试 | `packages/openai-compatible/src/OpenAICompatibleAdapter.test.ts` | 分块 SSE、异常、重试和取消 |
| Workspace | `packages/openai-compatible/package.json`、`package-lock.json` | 引入经验证的 SSE parser |
| 文档 | `README.md`、`docs/design/Karkata无头智能体运行时设计.md`、`docs/design/Karkata消息与会话协议.md` | 配置、状态、原子性和阶段路线 |

## Runtime 契约

- 一个 Agent 仍同时最多一次 `send()`；流式只改变单次模型调用的观察方式。
- `partialResponse` 是非持久状态投影，不会进入模型请求、历史压缩、结果或下一轮会话。
- 订阅者观察到的 partial 是按间隔合并的累计快照，不保证每个 Provider delta 都对应一次通知；文本顺序与最终内容不丢失。
- 只有完整最终 `AssistantMessage` 经现有验证后才进入 `#runMessages`。失败、中止和超时仍不提交不完整消息。
- 每次 `iterator.next()` 都必须可被 Runtime 的 AbortSignal 竞争中断；旧运行迟到事件不能修改状态、历史或结果。
- 多步 Tool Call 中，每一步都有独立 partial 生命周期；Tool Call 执行只基于最终组装完整消息。
- 订阅者异常仍隔离；增量内容通过 `structuredClone` 状态快照对外提供。

## 兼容性与迁移

`streaming` 默认关闭，现有 `LLMAdapter` 实现只需保留 `invoke()`。开启者需使用提供 `stream()` 的 Adapter，并可通过配置对象覆盖状态限频和输出上限。新协议仅使用 Async Iterator、Web Streams、AbortSignal 和 Fetch Response，不引入 Node 专属模块，保持 Core 和 Provider 的浏览器/Node.js 兼容。

OpenAI-compatible 流式只在显式启用时改变请求 body。`transformRequest` 仍看到完整 body，可按具体 Provider 追加 `stream_options` 等字段。回滚可移除可选配置/方法和 Provider 依赖，不涉及持久数据迁移。

## TDD 与验证方案

1. Red：Core 类型/行为测试表达显式配置、Adapter 能力检查、iterator 完成返回值、累积 partial 和最终提交，预期因公开契约不存在失败。
2. Green：实现最小流式消费路径，保持既有非流式测试通过。
3. Red/Green：覆盖缺少完成返回值、非法 delta、文本不一致、输出超限、Tool Call 多步与每步 partial 清理。
4. Red/Green：用 fake timer 覆盖 leading + trailing 状态限频；用可控 async iterator 覆盖手动中断、超时、忽略信号、非阻塞 `return()` 和迟到事件。
5. Red/Green：Provider 测试使用本地 `ReadableStream` 生成跨 chunk SSE，覆盖文本、Tool Call、`finish_reason` 后 usage、`[DONE]`/EOF、异常响应和取消。
6. Red/Green：覆盖建连前可重试失败与消费响应体后不自动重试。
7. Refactor：共享 Provider 请求序列化/发送/错误分类，保持快照和请求只读边界。
8. 更新 README 与两份设计基线，运行 Core/Provider 聚焦测试、`npm run check`、`npm run test:coverage` 和 `npm pack --workspaces --dry-run`。
