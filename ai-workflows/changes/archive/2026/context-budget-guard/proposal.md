# 变更提案：增加上下文预算与占用状态

## 背景

Karkata 已限制单个工具结果长度和 Agent 步数，但 system prompt、历史消息、当前运行消息与工具 Schema 仍会随多步运行持续扩大。Runtime 当前会直接调用模型，直到 Provider 拒绝超大请求；`TokenUsage` 虽由 Adapter 归一化，却只在成功响应后可用，不能提供调用前保护，也没有进入 UI 状态。

用户已明确确认最小公开契约：使用方只需要知道最大输入预算和当前预计占用；暂不公开真实 API 累计 usage，不实现自动压缩，但应为后续压缩保留稳定预算基础。

## 目标

- 支持使用方配置最大输入 token 预算和调用前估算器。
- 在每次模型调用前估算将要发送的完整 `LLMRequest`。
- 通过 `AgentState.contextUsage` 只公开 `maxTokens` 和 `usedTokens`，供 UI 直接呈现。
- 超过预算时返回 `CONTEXT_LIMIT_EXCEEDED`，不调用模型且不提交失败运行消息。
- 让估算等待遵守当前运行的取消、超时和迟到结果隔离规则。

## 范围

- Core 新增上下文预算、估算器、公开占用状态和估算失败错误契约。
- `Agent` 在完整请求组装后、调用 Adapter 前执行预算检查。
- 覆盖构造校验、多步增长、边界值、超限、估算失败、取消、超时、迟到结果和 `clearHistory()`。
- 更新 README、Runtime 设计、消息与会话协议及取消协议。

## 非目标

- 不公开或累计 Provider 返回的真实 `TokenUsage`。
- 不自动裁剪、摘要或压缩历史，不定义压缩策略接口。
- 不内置特定模型 tokenizer，也不从 `/models` 猜测上下文上限。
- 不修改 OpenAI-compatible 请求/响应协议或增加 Provider 包默认估算器。
- 不把输出 token 预留暴露为独立状态；`maxTokens` 已表示使用方允许的最大输入预算。

## 验收标准

- [x] 配置预算后，初始状态公开 `{ maxTokens, usedTokens: 0 }`；未配置时 `contextUsage` 不存在。
- [x] 每次模型调用前，估算器收到实际将发送的 system、历史、当前消息和工具定义，并携带当前 runId、step 与 AbortSignal。
- [x] 合法估算更新 `AgentState.contextUsage.usedTokens`；等于上限允许调用，超过上限不调用模型并返回不可重试的 `CONTEXT_LIMIT_EXCEEDED`。
- [x] 多步 Tool Call 后重新估算，工具结果和运行消息增长反映在下一步的 `usedTokens`。
- [x] `usedTokens` 不累计响应 `usage`；成功、模型失败或超限后保留最近一次预算检查值，`clearHistory()` 重置为 0。
- [x] 估算器异常或非法返回值产生安全、不可重试的 `CONTEXT_ESTIMATION_ERROR`，原始 cause 不进入公开状态。
- [x] 手动取消和超时能及时终止忽略信号的估算等待；迟到估算结果不能更新状态或调用模型。
- [x] 聚焦测试、全仓检查、覆盖率和打包预检通过。

## 风险

- 估算准确度由注入实现负责；Runtime 只校验结果为非负有限整数，不声称与 Provider 计费完全一致。
- 新增公共配置、状态和错误码，需要同步设计基线与声明测试。
- 异步估算器增加一个可取消等待点，必须复用现有 Promise 竞争和 runId 门禁。

## 待确认项

- 无。用户已明确批准最小状态契约并要求实施。
