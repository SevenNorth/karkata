# 变更提案：增加历史摘要与裁剪策略

## 背景

Karkata 已能在每次模型调用前估算完整请求，并在超过 `contextBudget.maxTokens` 时拒绝调用；但长会话一旦超过预算，只能以 `CONTEXT_LIMIT_EXCEEDED` 失败。现有 Runtime 不会删除旧历史，也没有让宿主注入摘要策略的稳定边界。

当前模型服务商的能力并不统一：部分原生 API 提供服务端 compaction、context editing 或滑动窗口，更多 Chat Completions 兼容接口只接收完整消息数组；prompt cache 和服务端会话也不等同于压缩。Karkata 因此不能把专有压缩端点假设为 `LLMAdapter` 的通用能力，而需要在 Core 中定义供应商无关的触发、候选历史、验证、回滚和取消契约。

## 目标

- 在上下文达到可配置阈值时，于模型调用前自动触发历史压缩策略。
- 允许宿主通过同一策略实现整轮裁剪、调用模型生成摘要，或调用能返回规范化历史的 Provider 能力。
- 压缩只替换已经成功提交的历史，不修改当前运行消息，并保持 Tool Call/Result 配对。
- 压缩候选必须重新估算并达到目标预算，才可供当前运行使用并在运行成功时原子提交。
- 压缩等待复用 Runtime 的取消、超时和迟到结果隔离规则。

## 范围

- Core 在 `ContextBudgetConfig` 下增加可选压缩配置、压缩回调与回调上下文。
- 触发阈值和目标预算采用滞回配置：`targetTokens < triggerTokens <= maxTokens`。
- 压缩回调接收冻结的当前有效已提交历史，返回完整的规范化候选历史；直接返回后缀表示裁剪，也可用一条普通 `user` 摘要消息替换旧前缀并保留最近消息。
- Core 校验候选历史的消息形状、Tool Call/Result 关联、名称一致性和 `callId` 唯一性，并对候选完整请求重新估算。
- 压缩后的历史在当前运行内暂存；只有运行成功才与本轮消息一起提交，失败、中断或超时恢复原历史。
- 增加安全的压缩失败错误，覆盖回调拒绝、非法候选和候选未达到目标预算。
- 更新 README、Core 公共声明及消息、预算、取消设计基线。

## 非目标

- 不把 prompt cache、Provider 会话 ID 或计费缓存命中视为上下文压缩。
- 不在 Core 内置摘要模型、默认摘要 Prompt、tokenizer 或内容取舍算法。
- 不让 Core 自动调用主 `LLMAdapter` 生成摘要；宿主可在压缩回调中显式选择模型、Prompt、凭据和成本策略。
- 不在 `@karkata/openai-compatible` 中实现 OpenAI Responses API 或任何返回 Provider 不透明压缩项的端点。
- 不压缩当前 `runMessages`，也不打断或重排一组 Tool Call/Result。
- 不提供持久化、checkpoint 或跨进程恢复。

## 验收标准

- [x] 未配置压缩时，现有预算检查、超限错误和 Adapter 调用行为完全不变。
- [x] 初始估算大于 `triggerTokens` 且存在可压缩历史时，压缩回调在 Adapter 之前收到冻结历史及当前 `runId`、`step`、`signal`、初始占用和目标预算。
- [x] 回调可返回只保留完整最近轮次的历史，也可返回“摘要消息 + 最近轮次”；合法候选重新估算不大于 `targetTokens` 后用于当前及后续模型步骤。
- [x] 压缩回调不能修改当前运行消息、临时 system prompt 或工具快照；候选历史不得留下未配对 Tool Call、重复 `callId` 或名称不一致的 Tool Result。
- [x] 当前运行完成时原子提交压缩历史和本轮消息；模型失败、压缩失败、中断或超时时保留压缩前的已提交历史。
- [x] 回调异常、非法候选或候选仍超过目标时，不调用主模型并返回固定安全的不可重试压缩错误，不泄漏原始 cause 或摘要内容。
- [x] 取消和超时能及时终止忽略 `AbortSignal` 的压缩等待；迟到结果不能更新状态、历史、预算占用或调用模型。
- [x] Core 聚焦测试、`npm run check`、覆盖率和 workspace 打包预检通过。

## 风险

- 摘要属于有损转换，事实、约束或安全上下文可能丢失；Core 只能验证结构与预算，不能判断语义质量。
- 把历史发送给额外模型或 Provider 可能增加成本、延迟和数据处理范围，必须由宿主显式配置。
- 摘要来自普通会话数据，若作为 system 消息返回会产生权限提升风险；文档默认要求使用 user 权限，可信 system 内容由宿主自行负责。
- 压缩改变后续模型可见历史和成功后的状态消息，是新的公共 Runtime 契约。
- 压缩发生在共享主循环的异步检查点，必须覆盖失败回滚、取消竞争和迟到结果。

## 待确认项

- 用户已于 2026-08-14 明确批准宿主注入 `compactHistory`、Core 不内置摘要模型的供应商无关方案。
- Provider 返回的不透明 compaction item 不进入当前通用 `AgentMessage`，原生 Responses 类 Adapter 留作独立 change。
