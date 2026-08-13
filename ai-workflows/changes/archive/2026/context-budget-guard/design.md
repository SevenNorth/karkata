# 技术设计：增加上下文预算与占用状态

## 现状分析

`Agent` 在每一步组装 system message、历史、当前运行消息和工具快照后，直接调用 `LLMAdapter.invoke()`。`maxToolResultLength` 只约束单项输出，无法限制完整请求。`LLMResponse.usage` 是事后数据，当前不会写入状态。

现有 `assembleSystemMessage()` 和 `resolveInstructions()` 已建立可取消的宿主回调模式；`awaitWithAbort()`、`#ensureCurrent()` 和 `#finish()` 提供取消收敛、迟到隔离及失败历史回滚。本变更复用这些机制，不新增并行状态机。

## 方案

Core 增加以下公共契约：

```ts
interface ContextUsage {
  maxTokens: number
  usedTokens: number
}

interface ContextEstimationContext {
  runId: string
  step: number
  signal: AbortSignal
}

type ContextTokenEstimator = (
  request: LLMRequest,
  context: ContextEstimationContext,
) => number | Promise<number>

interface ContextBudgetConfig {
  maxTokens: number
  estimateTokens: ContextTokenEstimator
}
```

`AgentConfig.contextBudget` 接受预算配置，`AgentState.contextUsage` 只暴露 `{ maxTokens, usedTokens }`。构造时验证 `maxTokens` 为正有限整数、估算器为函数，并初始化 `usedTokens: 0`。未配置时状态字段保持 `undefined`。

每一步组装唯一的 `LLMRequest` 局部变量。若配置预算，则在调用 Adapter 前通过 `awaitWithAbort(Promise.resolve().then(...), signal)` 执行估算器；成功后再次执行 runId/signal 门禁，再发布隔离状态快照。估算结果必须是非负有限整数。`usedTokens > maxTokens` 时以 `CONTEXT_LIMIT_EXCEEDED` 结束运行；相等允许调用。

`usedTokens` 的精确定义是“最近一次预算检查的完整模型请求预计输入 token 数”，不是历史 API 调用累计值或账单用量。响应 `usage` 不参与该字段。成功、Provider 错误和超限后保留最近值，便于 UI 呈现；`clearHistory()` 将其重置为 0。新一次 `send()` 在完成首次估算前保留上次值，避免 UI 先闪回 0。

估算器异常、同步 throw 或非法返回值由内部 `ContextEstimationError` 归一化为 `CONTEXT_ESTIMATION_ERROR`，公开固定安全消息，不复制原始 cause。取消/超时优先于该分类。估算输入使用即将传给 Adapter 的同一 `LLMRequest` 对象，确保预算基础未来可作为历史压缩触发点；本 change 不定义或调用压缩策略。

不把估算方法放入 `LLMAdapter`，因为预算是可选 Runtime 策略，且使用方可能有独立 tokenizer 服务；强制所有 Adapter 实现会扩大无预算场景的接口。不提供字符数默认估算，避免 UI 把未经选择的近似规则误认为 token。

## 影响范围

| 包或区域 | 文件 | 变更 |
| --- | --- | --- |
| Core | `packages/core/src/types.ts`、`Agent.ts`、测试 | 配置、估算检查、状态和错误契约 |
| 文档 | `README.md`、`docs/design/*` | UI 状态语义、会话与取消规则 |
| change | `ai-workflows/changes/active/context-budget-guard/*` | 审批、TDD 与验证证据 |

## Runtime 契约

- 预算覆盖实际传给 Adapter 的完整 `LLMRequest`，包括临时 system message、已提交历史、当前运行消息与当前工具快照。
- 预算检查发生在每次 Adapter 调用前；超限请求不会到达 Adapter。
- `contextUsage` 是隔离快照，只含两个非负整数。`maxTokens` 在 Agent 生命周期内固定，`usedTokens` 只由有效当前运行更新。
- 超限和估算失败属于运行错误，失败运行不提交 `runMessages`；已经成功提交的历史保持不变。
- 估算器接收当前运行 `AbortSignal`。即使忽略 signal，取消 Promise 竞争仍使 `send()` 及时收敛，迟到结果不得更新状态。
- 后续压缩若实现，必须在同一请求组装与预算检查点之前产生候选历史，并保持 Tool Call/Result 配对、失败回滚和取消隔离；本 change 不提前承诺具体策略接口。

## 兼容性与迁移

配置完全可选，既有 Agent 行为不变。新契约只使用标准 Promise、AbortSignal 和结构化数据，保持 Node/浏览器兼容。项目尚未发布，无弃用周期；回滚不涉及持久化迁移。

## TDD 与验证方案

1. Red：从公共类型配置预算，断言初始/未配置状态、完整请求估算、边界值、超限无模型调用和多步增长；预期因配置与状态不存在失败。
2. Green：实现最小类型、构造校验、调用前估算和超限错误，使主行为通过。
3. Red：增加估算异常/非法值、取消、超时、迟到结果、状态隔离、Provider usage 不累计及 `clearHistory()` 测试。
4. Green：实现安全估算错误和可收敛等待，补齐生命周期语义。
5. Refactor：提取预算检查方法和冻结 context，保持唯一请求对象与现有循环清晰。
6. 更新 README 和三份受影响设计文档；运行 Core 聚焦测试、`npm run check`、覆盖率、workspace pack dry-run、声明、change 与 Git 检查。
