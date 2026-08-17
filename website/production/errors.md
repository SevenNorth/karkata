---
title: 错误处理
description: 生产环境中的错误分类、重试和安全展示
---

# 错误处理

`AgentResult` 在失败时包含结构化错误。UI 可以展示 `message`，但服务端日志应使用 `code`、`retryable`、request id 和脱敏元数据，不要直接回显 Provider 原始正文。

## 分类

| 类别 | 代表错误码 | 是否默认重试 | 处理建议 |
| --- | --- | --- | --- |
| Provider 网络/限流 | `MODEL_NETWORK_ERROR`、`MODEL_RATE_LIMIT` | 网络和 429 可重试 | 指数退避、并发限制和用户可重试提示 |
| Provider 鉴权/请求 | `MODEL_AUTH_ERROR`、`MODEL_PROVIDER_ERROR` | 否 | 检查服务端凭据、模型白名单和上游状态 |
| Provider 响应 | `MODEL_INVALID_RESPONSE` | 否 | 记录安全元数据，检查协议兼容性 |
| 工具输入与执行 | `TOOL_INVALID_INPUT`、`TOOL_EXECUTION_ERROR` | 否 | 校验输入、重新授权、检查幂等性 |
| 工具版本 | `TOOL_CHANGED`、`TOOL_NOT_FOUND` | 否 | 使用最新工具快照，让模型重新决策 |
| 运行边界 | `MAX_STEPS_EXCEEDED`、`TIMEOUT`、`ABORTED` | 否 | 结束本轮；不要提交不完整消息 |
| 上下文 | `TOOL_RESULT_TOO_LARGE`、`CONTEXT_LIMIT_EXCEEDED`、`CONTEXT_ESTIMATION_ERROR`、`CONTEXT_COMPACTION_ERROR` | 否 | 缩短输入、限制工具输出或调整预算 |

`MODEL_ERROR`、`INSTRUCTION_RESOLUTION_ERROR`、`INSTRUCTIONS_TOO_LARGE` 和 `INTERNAL_ERROR` 也会终止本轮。除非错误明确标记 `retryable`，应用不应自动重放整个 Agent 运行。

## 取消和迟到结果

取消或超时后，Runtime 会及时收敛并隔离迟到的模型/工具结果。它不能撤销已经发送到外部系统的副作用；付款、写入和删除工具必须使用幂等键和服务端补偿策略。

## 网关映射

网关可以把上游 HTTP 状态映射为统一的 `4xx`、`429` 或 `5xx`，但不要把 API Key、完整请求、响应正文或内部堆栈发给浏览器。为每次请求生成 correlation id，并把公开错误和内部日志分开。
