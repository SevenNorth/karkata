# 变更提案：将 model 改为可选配置

## 背景

`@karkata-ai/openai-compatible` 当前要求前端 Adapter 同时提供 `model` 和 `baseURL`。在浏览器运行 Karkata、后端仅代理 LLM 的场景中，模型选择属于代理服务的部署策略；前端只需要知道代理的 `baseURL`，也可以按使用方需要附带模型请求元数据。

## 目标

让 `baseURL` 成为唯一必填配置，使 `model` 可选；有值时继续发送给兼容服务，无值时省略请求体中的 `model` 字段，由后端决定默认模型、覆盖策略或拒绝策略。

## 范围

- 修改 OpenAI-compatible Adapter 和 Agent 工厂配置类型及运行时校验。
- 增加有 `model` 与无 `model` 的请求序列化测试。
- 更新 Provider README、根 README 和相关设计基线，说明 Proxy 场景语义。

## 非目标

- 不实现后端 LLM Proxy、鉴权、限流、计费或 demo。
- 不改变 Core Agent、消息协议、工具协议和流式协议。

## 验收标准

- [x] 仅提供 `baseURL` 时可以创建 Adapter/Agent，并成功发送不含 `model` 字段的请求。
- [x] 提供 `model` 时保持现有请求体行为。
- [x] 缺少 `baseURL` 仍被明确拒绝。
- [x] 类型、README 和设计文档明确说明 `model` 是否采纳由服务端决定。

## 风险

- 直接连接要求 `model` 的 Provider 可能在服务端返回校验错误；这是代理或 Provider 的策略，不由 Adapter 猜测。
- 公共配置类型变化需要同步发布说明和测试。

## 待确认项

- 无。
