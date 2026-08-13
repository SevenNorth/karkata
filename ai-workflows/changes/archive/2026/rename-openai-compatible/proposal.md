# 变更提案：重命名 OpenAI 兼容协议包

## 背景

当前 `@karkata/openai` 实际调用使用方提供的 `baseURL` 下的 `/chat/completions`，支持的是 OpenAI 风格兼容协议，而不仅是 OpenAI 官方服务。现有包名和公开类名容易让使用方误解支持范围。

项目尚未发布，用户已批准在发布前直接修正命名，不保留旧包名或旧类型别名。

## 目标

- 将包目录和 npm 包名改为 `packages/openai-compatible` 与 `@karkata/openai-compatible`。
- 将公开类名改为 `OpenAICompatibleAdapter`。
- 将公开配置类型改为 `OpenAICompatibleAdapterConfig` 和 `OpenAICompatibleCreateAgentConfig`。
- 保留简洁工厂名 `createAgent()`。
- 同步 workspace、lockfile、测试别名、仓库约束、README 和设计文档。

## 范围

- 重命名 Provider 包目录、源码文件、测试文件和公开导出。
- 通过 npm 命令更新 lockfile 的 workspace 链接。
- 更新当前设计基线和使用示例。
- 增加公开入口与请求协议行为的回归测试。

## 非目标

- 不保留 `@karkata/openai` 或 `OpenAIAdapter` 兼容别名。
- 不改变 `/chat/completions` 请求、响应归一化、重试或取消行为。
- 不声称支持所有模型协议。
- 不修改 Core 的 `LLMAdapter` 契约。

## 验收标准

- [x] workspace 只包含 `@karkata/openai-compatible`，不再包含旧包名。
- [x] 新包公开导出 `OpenAICompatibleAdapter`、两个新配置类型和 `createAgent()`。
- [x] 工厂返回标准 Core `Agent`，并可通过兼容协议完成模型调用。
- [x] 源码、当前设计基线和仓库约束中不再引用旧包名或旧公开类型。
- [x] lockfile、TypeScript project reference、Vitest alias 和打包产物全部使用新名称。
- [x] Core 不增加 Provider 依赖，既有运行时行为不变。

## 风险

- 这是破坏性重命名；因项目尚未发布，明确不提供迁移别名。
- `OpenAI-compatible` 仅表示当前 Chat Completions 消息和 Tool Call 协议兼容，不覆盖原生 Anthropic、Gemini 等协议。

## 待确认项

- 无。用户已明确批准按建议命名实施。
