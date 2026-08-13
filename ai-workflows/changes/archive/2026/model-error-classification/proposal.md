# 变更提案：完善模型错误分类与调试契约

## 背景

Core 当前将除提示词组装之外的模型调用异常统一折叠为 `MODEL_ERROR`，使用方无法区分网络故障、鉴权失败、限流、无效响应和普通 Provider 故障，也无法判断错误是否值得重试。

`@karkata/openai-compatible` 已按 HTTP 状态决定内部重试，但其错误类型是包内私有实现，最终分类不会传递给 Core；非成功响应还会把完整响应正文拼入异常消息，存在将供应商返回的敏感内容带入 `AgentResult` 和 `AgentState` 的风险。设计基线已经列出更细的模型错误分类和 `retryable` 元数据，阶段二应补齐该契约。

## 目标

- 在 Core 建立 Provider 无关的标准化模型错误边界。
- 让 `AgentResult` 和 `AgentState` 区分网络、鉴权、限流、无效响应和普通 Provider 故障。
- 在公开 `AgentError` 中提供明确的 `retryable` 标记。
- 为 HTTP 模型故障提供可选且安全的 `statusCode` 调试元数据。
- 让 OpenAI-compatible Adapter 只重试网络、限流和服务端故障，不重试鉴权、普通 4xx 与无效响应。
- 保证 API Key、Authorization Header、请求体和未脱敏响应正文不进入公开错误、结果或状态。

## 范围

- 新增并导出 Provider 无关的 `ModelError`、`ModelErrorCode`、重试与 HTTP 状态元数据契约。
- 扩充 `AgentErrorCode`，并由 Core 将标准化模型错误映射为安全的 `AgentError`。
- 保留未知 Adapter 异常到 `MODEL_ERROR` 的兼容回退。
- 归一化 OpenAI-compatible 的网络异常、HTTP 状态异常、JSON/Schema/Tool Call 解析异常。
- 增加 Core 和 OpenAI-compatible 的公开行为与敏感信息回归测试。
- 更新 README 和受影响的 Runtime 设计基线。

## 非目标

- 不增加全局日志器、事件流、遥测或 Provider 原始请求/响应调试接口。
- 不实现 token 上下文预算或 `CONTEXT_LIMIT_EXCEEDED`。
- 不在本次增加内容过滤或 Provider 特有 `finish_reason` 分类；发现后先归入无效响应。
- 不改变工具错误、提示词错误、取消、超时和会话提交语义。
- 不改变重试次数和退避默认值，不在 Core 增加第二层模型重试。
- 不保证第三方 Adapter 自动获得细分类；它们需要主动抛出标准化 `ModelError`。

## 验收标准

- [x] 标准化模型异常分别产生 `MODEL_NETWORK_ERROR`、`MODEL_AUTH_ERROR`、`MODEL_RATE_LIMIT`、`MODEL_INVALID_RESPONSE` 或 `MODEL_PROVIDER_ERROR`，并携带正确的 `retryable` 和可用时的 `statusCode`。
- [x] 未采用新契约的 Adapter 异常继续产生 `MODEL_ERROR`，避免既有集成失去错误结果。
- [x] OpenAI-compatible 对 401/403 归类为鉴权错误，对 429 归类为限流，对 5xx 归类为 Provider 错误，对 fetch 网络失败归类为网络错误，对响应 JSON、Schema 或 Tool Call 参数解析失败归类为无效响应。
- [x] OpenAI-compatible 只重试网络错误、429 和 5xx；鉴权、其他 4xx 与无效响应只调用一次。
- [x] 公开错误的消息与可枚举字段不包含 API Key、Authorization、请求体或响应正文中的敏感标记。
- [x] 手动取消和超时仍优先于模型错误分类，失败运行仍不提交不完整会话。
- [x] Core、OpenAI-compatible 聚焦测试与全仓必需门禁通过。

## 风险

- `AgentErrorCode` 和 `AgentError.retryable` 是公共契约变化，需要同步更新设计、声明和测试。
- 供应商错误正文不再出现在公开消息中会减少直接调试信息；这是为防止状态泄密而做的有意收敛，安全诊断只保留类别和 HTTP 状态。
- 不同 OpenAI-compatible 服务可能使用非标准 HTTP 状态；未知状态统一落入普通 Provider 故障，避免猜测业务语义。

## 待确认项

- 无。用户已接受“标准化模型错误、可重试标记和安全公开消息”的建议并要求开始实施。
