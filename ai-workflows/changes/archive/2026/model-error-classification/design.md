# 技术设计：完善模型错误分类与调试契约

## 现状分析

`LLMAdapter.invoke()` 只约定返回 `LLMResponse`，没有声明失败类型。`Agent.send()` 的 catch 分支除取消和 `PromptAssemblyError` 外，全部生成 `MODEL_ERROR`，并把原异常放入公开 `AgentError.cause`。这既丢失分类，也可能通过状态快照暴露 Adapter 异常中的敏感数据。

OpenAI-compatible Adapter 内部的 `OpenAIHTTPError` 只记录 `status` 和 `retryable`。它对 429/5xx 重试，但把非成功响应的完整正文拼入 message；响应 JSON、Zod Schema、Tool Call arguments 解析失败及大部分运行时异常会被当成可重试错误。相邻测试目前只覆盖成功规范化和 400 不重试。

参考 `E:/Open_Source/page-agent/packages/llms` 后确认，其 `InvokeError` 使用结构化 `type`、`retryable`、`statusCode`，重试层只依据错误元数据，并让 AbortError 直接穿透。这三点适合 Karkata。其 `rawError`、`rawResponse`、`rawRequest` 会进入调用结果或 Agent 历史，且未知异常默认重试；这些做法不符合 Karkata 的状态安全边界和“只重试明确可重试错误”约束，不予沿用。

## 方案

Core 新增 Provider 无关的标准化异常：

```ts
type ModelErrorCode =
  | 'MODEL_NETWORK_ERROR'
  | 'MODEL_AUTH_ERROR'
  | 'MODEL_RATE_LIMIT'
  | 'MODEL_INVALID_RESPONSE'
  | 'MODEL_PROVIDER_ERROR'

interface ModelErrorOptions {
  code: ModelErrorCode
  message: string
  retryable: boolean
  statusCode?: number
  cause?: unknown
}

class ModelError extends Error {
  readonly code: ModelErrorCode
  readonly retryable: boolean
  readonly statusCode?: number
}
```

构造参数只接受已脱敏的公开消息、可选 HTTP `statusCode` 与可选 `cause`。`cause` 供 Adapter 调用栈内部保留，不复制到 `AgentError`、`AgentResult` 或 `AgentState`。Core 捕获 `ModelError` 后复制 `code`、安全 message、`retryable` 和 `statusCode`；未知异常继续映射为 `MODEL_ERROR`、`retryable: false`，但同样不再把原始 cause 放入公开状态。

OpenAI-compatible 在 Adapter 边界把失败归一化：

| 来源 | code | retryable | statusCode | 公开消息 |
| --- | --- | --- | --- | --- |
| fetch 拒绝 | `MODEL_NETWORK_ERROR` | `true` | 无 | 不含 URL、Header 或请求体的网络失败描述 |
| HTTP 401/403 | `MODEL_AUTH_ERROR` | `false` | 原始状态 | 只包含 HTTP 状态 |
| HTTP 429 | `MODEL_RATE_LIMIT` | `true` | 原始状态 | 只包含 HTTP 状态 |
| HTTP 5xx | `MODEL_PROVIDER_ERROR` | `true` | 原始状态 | 只包含 HTTP 状态 |
| 其他非成功 HTTP | `MODEL_PROVIDER_ERROR` | `false` | 原始状态 | 只包含 HTTP 状态 |
| 响应 JSON、Schema、Tool Call 参数无效 | `MODEL_INVALID_RESPONSE` | `false` | 成功响应的状态 | 固定的无效响应描述 |

重试循环只依据标准化错误的 `retryable`。AbortError 和已触发 signal 原样抛出，让 Core 现有终止优先级处理。动态 Header resolver 与 `transformRequest` 属于宿主配置代码；其异常归为非重试的 `MODEL_PROVIDER_ERROR`，公开消息不复制原异常文本。

不采用 Provider 在 `LLMResponse` 中返回错误联合的方案，因为失败响应没有有效模型消息，且会迫使每个 Core 调用点同时处理 throw/return 两条失败通道。不增加错误正文脱敏正则，因为无法可靠识别任意供应商数据；直接不读取或不传播正文是可验证的安全边界。

## 影响范围

| 包或区域 | 文件 | 变更 |
| --- | --- | --- |
| Core | `packages/core/src/errors.ts`、`types.ts`、`Agent.ts`、`index.ts`、`Agent.test.ts` | 标准模型错误、公开错误分类与状态映射 |
| OpenAI-compatible | `packages/openai-compatible/src/OpenAICompatibleAdapter.ts`、相邻测试 | Provider 错误归一化和重试分类 |
| 文档 | `README.md`、`docs/design/Karkata无头智能体运行时设计.md` | 公开契约、错误安全边界和阶段进度 |
| change | `ai-workflows/changes/active/model-error-classification/*` | 审批、TDD 和验证证据 |

## Runtime 契约

- `ModelError` 是 Adapter 到 Core 的失败边界；Core 不依赖任何 Provider 专属异常。
- `AgentErrorCode` 包含五个细分模型错误，并保留 `MODEL_ERROR` 作为未知 Adapter 异常回退。
- 所有 `AgentError` 都提供 `retryable: boolean` 和可选的有限整数 `statusCode`。任务级限制、取消、工具、提示词和内部错误默认为不可重试；本 change 不改变这些错误的 code 或控制流。
- 模型异常的原始 `cause` 不进入公开结果和状态。`AgentState` 仍通过隔离快照发布，且不包含请求、响应或鉴权数据。
- 取消 signal 已触发时不生成模型错误；超时返回 `TIMEOUT`，手动中断返回 `aborted`。
- 错误运行继续丢弃 `runMessages`，不修改已提交历史。

## 兼容性与迁移

新增的 `ModelError` 使用标准 `Error`，不引入 Node 专属模块，保持浏览器和 Node.js 兼容。第三方 Adapter 无需立即迁移：抛出普通异常仍得到 `MODEL_ERROR`。希望提供细分类的 Adapter 应改为抛出 `ModelError`。

`AgentError.retryable` 从可选信息收敛为必填布尔值，`AgentError.cause` 从公开状态契约移除。项目尚未发布，因此不设置弃用周期；README 和声明同步更新。回滚时可整体撤销本 change，不涉及持久化数据迁移。

## TDD 与验证方案

1. Core Red：由假 Adapter 抛出各类 `ModelError`，断言公开结果/状态的 code、retryable、statusCode、安全消息与失败历史；预期因 `ModelError` 不存在和 Core 仍统一返回 `MODEL_ERROR` 失败。
2. Core Green：实现标准错误类型、导出和 `Agent.send()` 映射；运行 Core 聚焦测试。
3. Provider Red：分别构造网络拒绝、401/403、429、5xx、普通 4xx、无效 JSON/Schema/Tool Call 参数，断言分类、重试次数和敏感标记隔离；预期因私有粗分类、过度重试和响应正文泄露失败。
4. Provider Green：集中实现 HTTP 与响应归一化，使聚焦测试通过；使用 fake timers 验证重试时恢复 timer。
5. Refactor：统一错误创建和响应解析边界，核对包入口与生成声明，保持取消信号原样传播。
6. 文档与门禁：更新 README 和 Runtime 设计，运行两个包的聚焦测试、`npm run check`、`npm run test:coverage`、`npm pack --workspaces --dry-run`、change 校验及 `git diff --check`。
