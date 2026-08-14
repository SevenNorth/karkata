# 技术设计：增加历史摘要与裁剪策略

## 现状分析

`Agent.send()` 每一步依次组装临时 system message、`#history`、`#runMessages` 和工具快照；启用预算时冻结完整 `LLMRequest`，调用 `estimateTokens()`，随后才调用 `LLMAdapter.invoke()`。超过 `maxTokens` 会直接失败。`#history` 只在整个运行成功时追加 `#runMessages`，因此失败运行不会污染后续请求。

`ContextTokenEstimator` 已提供可取消的宿主回调模式，`awaitWithAbort()`、`#ensureCurrent()` 和 runId 门禁已覆盖忽略 signal 的异步依赖。压缩应插入同一个预算检查点，并复用这些原语。

当前 `AgentMessage` 已能表达 `system`、`user`、`assistant` 和 `tool`。压缩策略可用普通 `user` 消息承载明确标注的会话摘要，无需在首版扩展 Provider 消息协议；这样不会把来源于会话的数据提升为可信 system 指令。压缩策略仍必须返回结构完整的规范化历史。

## 方案

在 `ContextBudgetConfig` 中增加可选配置：

```ts
export interface ContextCompactionContext {
  readonly runId: string
  readonly step: number
  readonly signal: AbortSignal
  readonly usedTokens: number
  readonly targetTokens: number
  readonly maxTokens: number
}

export type ContextHistoryCompactor = (
  history: readonly AgentMessage[],
  context: ContextCompactionContext,
) => readonly AgentMessage[] | Promise<readonly AgentMessage[]>

export interface ContextCompactionConfig {
  readonly triggerTokens: number
  readonly targetTokens: number
  readonly compactHistory: ContextHistoryCompactor
}

export interface ContextBudgetConfig {
  readonly maxTokens: number
  readonly estimateTokens: ContextTokenEstimator
  readonly compaction?: ContextCompactionConfig
}
```

构造时验证 `targetTokens`、`triggerTokens` 为正有限整数，且 `targetTokens < triggerTokens <= maxTokens`，并验证 `compactHistory` 为函数。阈值形成滞回区间，避免刚压缩后在下一步立即重复压缩。

每个运行维护一个局部 `effectiveHistory`，初始引用压缩前的 `#history`。每一步执行以下流程：

1. 用 `effectiveHistory + #runMessages` 组装并冻结完整请求，执行初始估算并更新 `contextUsage`。
2. 若占用不大于 `triggerTokens`，沿用现有预算与模型调用路径。
3. 若超过阈值但 `effectiveHistory` 为空，不调用压缩器；不超过 `maxTokens` 时仍可调用模型，超过时返回现有 `CONTEXT_LIMIT_EXCEEDED`。
4. 若超过阈值且存在历史，向 `compactHistory` 传入深冻结副本。回调只能返回新的完整候选历史，不能接触或替换 `runMessages`、临时 system message和工具定义。
5. Core 深克隆候选，执行规范化历史校验，再用同一 system、当前运行消息和工具快照重组请求并重新估算。只有候选占用不大于 `targetTokens` 才替换 `effectiveHistory` 并调用模型。
6. 后续工具步骤继续使用 `effectiveHistory`。运行成功时执行 `#history = [...effectiveHistory, ...#runMessages]`；任意失败或终止时丢弃 `effectiveHistory` 和本轮消息，保留原 `#history`。

历史校验至少保证：数组和消息形状合法；AssistantMessage 非空；`callId` 在候选内唯一；每个 Tool Result 能关联前面的 Tool Call、名称一致且每个调用恰有一个结果；候选末尾不存在未完成调用。它不判断摘要内容是否忠实，也不要求候选是原历史的字面后缀，因为摘要策略需要生成替代消息。

新增 `CONTEXT_COMPACTION_ERROR`：压缩回调抛错、返回非法值、候选结构无效或重新估算后未达到 `targetTokens` 时使用固定安全消息结束运行。估算器自身失败仍使用 `CONTEXT_ESTIMATION_ERROR`；候选合法但压缩前没有历史且请求超过最大值，仍使用 `CONTEXT_LIMIT_EXCEEDED`。

拒绝让 Core 自动复用主 `LLMAdapter`。摘要调用可能需要不同模型、Prompt、重试、凭据、合规范围和成本控制，偷偷复用会把内容策略混入 Runtime。宿主可在 `compactHistory` 内把旧历史发送给模型并明确要求输出摘要，也可以确定性删除最旧的完整轮次。

拒绝把 Provider 原生 compaction 设为 `LLMAdapter` 必选方法。OpenAI Responses 等能力可能返回只能回传给同一 Provider 的不透明项，无法安全归一化为当前 `AgentMessage`；而 Chat Completions 兼容服务通常没有等价端点。此类能力需要原生 Adapter 和独立消息/会话契约，超出本 change。

## 影响范围

| 包或区域 | 文件 | 变更 |
| --- | --- | --- |
| Core | `packages/core/src/types.ts`、`Agent.ts`、相邻测试 | 压缩配置、回调、候选历史、预算重检和错误契约 |
| Core | 可能新增内部历史校验模块 | 集中验证规范化消息与 Tool Call/Result 不变式 |
| 文档 | `README.md`、`docs/design/Karkata无头智能体运行时设计.md`、消息与取消协议 | 使用示例、Provider 边界、原子提交和取消语义 |
| change | `ai-workflows/changes/active/history-compaction-policy/*` | 审批、TDD 和验证证据 |

## Runtime 契约

- 压缩是 `contextBudget` 的可选子能力；未配置时不增加回调或异步边界。
- 压缩只处理当前运行开始前已成功提交、或本运行内已暂存压缩过的有效历史；当前 `runMessages` 永不交给压缩器。
- 摘要作为候选历史中的普通 `user` 消息，会出现在成功提交后的 `AgentState.messages` 并参与后续压缩。Core 仍接受合法 `AgentMessage`，但宿主对自行返回的可信 system 内容负责。
- 压缩候选只有在结构验证和完整请求重新估算通过后才成为本运行的有效历史。
- 成功运行原子提交候选历史和本轮消息；失败、中断、超时及压缩错误不提交候选历史。
- `ContextHistoryCompactor` 接收当前运行的 `AbortSignal`。取消 Promise 竞争保证及时收敛，runId 门禁隔离迟到结果。
- 初始及候选估算都可以更新 `contextUsage.usedTokens`；终态保留最近一次有效估算。迟到估算或压缩结果不能更新该状态。
- `CONTEXT_COMPACTION_ERROR` 不可重试且公开固定安全消息，不包含回调 cause、历史或摘要内容。

## 兼容性与迁移

配置完全可选，现有 `AgentConfig`、`LLMAdapter` 与 OpenAI-compatible 请求协议不变。新增契约只使用标准结构化数据、Promise 和 AbortSignal，保持 Node/浏览器兼容。

策略返回的额外 `system` 历史消息依赖 Adapter 已有的 `AgentMessage` 支持；现有 OpenAI-compatible Adapter 无需新增端点。自定义 Adapter 若已完整实现公共 `AgentMessage` 联合，同样无需迁移。项目尚未发布，无持久化数据迁移。

## TDD 与验证方案

1. Red：新增公共配置和构造校验测试；新增阈值触发、冻结回调输入、候选重估及低于阈值不调用测试，预期因配置不存在失败。
2. Green：实现最小类型、校验和预算检查点压缩，使主路径通过。
3. Red：增加直接裁剪、普通 user 摘要消息、工具配对/重复 ID/非法返回验证，以及候选未达目标和安全错误测试。
4. Green：实现候选历史验证和错误分类。
5. Red：增加当前运行不可压缩、多步复用候选、成功原子提交、模型失败回滚、手动取消、超时及迟到结果隔离测试。
6. Green：引入运行级 `effectiveHistory`，复用现有取消竞争和 runId 门禁。
7. Refactor：整理请求组装、估算和历史校验，确保未配置路径不新增异步边界。
8. 更新 README 与受影响设计基线；执行 Core 聚焦测试、`npm run check`、`npm run test:coverage`、`npm pack --workspaces --dry-run`、change 校验和 `git diff --check`。
