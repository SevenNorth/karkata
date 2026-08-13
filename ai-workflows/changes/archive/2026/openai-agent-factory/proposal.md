# 变更提案：增加 OpenAI Agent 便捷工厂

## 背景

Karkata 当前要求使用方先构造 `OpenAIAdapter`，再将其作为 `llm` 传入 Core `Agent`。这种方式保持了 Core 与 Provider 解耦，但简单的 OpenAI-compatible 场景需要理解两层对象并编写额外样板代码。

用户已确认目标：保持 `@karkata/core` 不耦合任何 Provider，同时由 Provider 包提供简洁的实例化入口。

## 目标

- 在 `@karkata/openai` 增加公开 `createAgent()` 便捷工厂。
- 将 OpenAI Adapter 配置保持在顶层，将 Runtime 配置放入可选 `agent` 字段。
- 工厂内部组合 `OpenAIAdapter` 和 Core `Agent`，返回标准 `Agent` 实例。
- 保留 `new Agent({ llm })` 和 `new OpenAIAdapter()` 两种底层用法。
- 文档明确该包支持 OpenAI-compatible `/chat/completions` 协议，而非 Core 默认 Provider。

## 范围

- 新增 `OpenAICreateAgentConfig` 公开类型和 `createAgent()` 导出。
- 增加工厂配置转发与实际调用行为测试。
- 更新 README 与 Runtime 设计文档中的推荐用法和分层边界。

## 非目标

- 不修改 `@karkata/core` 的 `AgentConfig` 或构造函数。
- 不在 Core 中增加 Provider 字符串、自动探测或动态加载。
- 不增加 Anthropic、Gemini 等 Provider。
- 不支持在同一 Agent 运行期间切换 Adapter。

## 验收标准

- [x] `createAgent({ model, baseURL, ... })` 返回标准 Core `Agent`。
- [x] 顶层 Provider 配置完整传递给 `OpenAIAdapter`。
- [x] 可选 `agent` 配置完整传递给 Core `Agent`，且使用方不能通过该字段覆盖 `llm`。
- [x] 创建后的 Agent 可完成真实的规范化模型调用，不依赖真实网络。
- [x] 既有 `OpenAIAdapter` 和 Core Adapter 注入用法保持兼容。
- [x] Core 不新增对 `@karkata/openai` 的依赖或 Provider 概念。
- [x] README 和设计文档同时展示便捷入口与底层入口。

## 风险

- `createAgent` 名称较通用；通过包名 `@karkata/openai` 表达 Provider，多个 Provider 同时使用时可在 import 处别名。
- 顶层 Provider 配置与 `agent` 分层是新增公开契约，后续字段演进必须保持该边界。

## 待确认项

- 无。用户已明确批准该方案并要求开始实施。
