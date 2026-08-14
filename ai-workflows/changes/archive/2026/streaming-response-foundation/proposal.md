# 变更提案：增加流式回答基础

## 背景

Karkata 当前的 `LLMAdapter.invoke()` 只能在模型完整生成后返回 `LLMResponse`。对 C 端会话界面而言，长回答期间只能显示“正在处理”，用户无法及时看到已生成内容。OpenAI-compatible Adapter 也尚未开启或解析 SSE stream。

流式回答同时涉及 Core 状态、Provider 协议和 UI 投影。为避免一次跨三个子系统改动，本 change 只建立 Core + OpenAI-compatible 的可独立验收基础；`@karkata/ui` 的增量消息投影另立后续 change。

## 目标

- 定义 Provider 无关的文本增量与最终响应协议，不向 Core 暴露 SSE 或 Provider chunk。
- 显式启用后，`AgentState` 可订阅当前步骤已累积的 Assistant 文本，最终 `AgentResult` 和会话历史契约保持不变。
- OpenAI-compatible Adapter 支持 SSE 文本与分片 Tool Call 组装，并保持取消、错误分类和密钥脱敏边界。

## 范围

- `LLMAdapter` 新增可选流式方法；iterator 只 yield 规范化文本增量，并以完成返回值交付最终 `LLMResponse`。既有 `invoke()` 仍为必需的非流式能力。
- `AgentConfig` 新增默认关闭的流式配置对象，包含状态更新间隔和输出长度上限；`AgentState` 新增隔离于 `messages` 的部分回答投影。
- Core 处理增量顺序、最终响应校验、多步工具循环、取消/超时竞争和迟到结果隔离。
- OpenAI-compatible Adapter 请求 `stream: true`，解析 SSE，累积 Tool Call 分片并输出规范化最终响应。
- 更新核心设计文档、消息与会话契约及 README。

## 非目标

- 不修改 `@karkata/ui`、Web Component 或 Demo；它们在后续 change 消费 Core 增量状态。
- 不默认开启流式，不删除或放宽 `invoke()` 契约。
- 不公开 Provider 原始 chunk、thinking/reasoning、logprobs、音频、图像或 Tool Call 参数增量。
- 不实现 checkpoint、持久化、Markdown 或原生 Provider 不透明上下文项。

## 验收标准

- [x] 未启用流式时只调用 `invoke()`，现有自定义 Adapter 和运行结果无需迁移。
- [x] 启用流式但 Adapter 未提供流时在 Agent 构造期明确失败，不静默降级。
- [x] 文本增量按顺序累积为 `partialResponse`，快照按配置间隔限频发布，但半成品不进入 `AgentState.messages`。
- [x] 最终响应与累积文本一致时按原契约完成；Tool Call 仍进入同一多步循环。
- [x] iterator 提前结束但未返回有效响应、delta 非法或最终文本不一致时安全失败，不提交当前运行。
- [x] 累积内容超过配置上限时终止流并产生安全的不可重试错误，不继续占用内存。
- [x] 中止、超时或流读取失败会清理 `partialResponse`，并且忽略不遵守信号的迟到 chunk。
- [x] OpenAI-compatible SSE 能处理跨网络 chunk 的 event 和分片 Tool Call，最终产生与非流式路径同构的 `LLMResponse`。
- [x] 建连/HTTP 错误沿用现有分类和重试；已开始消费响应体后不自动重试，避免重复文本。
- [x] Core/Provider 聚焦测试、类型测试、`npm run check`、覆盖率和打包预检通过。

## 风险

- SSE event 和 JSON 可跨任意网络 chunk 分割，手写行分割易产生协议缺陷；实施优先使用经验证的 SSE parser。
- Tool Call 的 ID、名称和 JSON arguments 可分多个 chunk，只能在最终组装后解析与校验。
- 长历史下频繁快照会放大 `structuredClone` 与订阅成本；Core 必须对状态发布限频，UI 层仍需用 keyed 更新。
- 流式输出可以在超时前持续增长；必须在 Core 内部按字符数限制累积内容，不仅依赖 Provider 的 token 配置。
- 已显示部分文本后的失败不能无痕重试；Core 仍回滚模型历史，UI 将在后续 change 决定失败文本的展示方式。

## 待确认项

- 是否同意按“流式基础（Core + Provider）”和“UI 增量投影”拆成两个可独立验收的 change。
- 是否接受 `AgentConfig.streaming: { stateUpdateIntervalMs?, maxOutputLength? }` 显式开启，以及 `AgentState.partialResponse` 不进入 `messages` 的公开边界。
