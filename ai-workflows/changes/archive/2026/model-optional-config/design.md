# 技术设计：将 model 改为可选配置

## 现状分析

已阅读 `packages/openai-compatible/src/OpenAICompatibleAdapter.ts`、`createAgent.ts`、对应 Adapter 测试、根 README、Provider README，以及 `docs/design/Karkata无头智能体运行时设计.md`。当前构造函数以 `!config.model || !config.baseURL` 拒绝配置，`#prepareRequest()` 总是写入 `model`。

## 方案

将 `OpenAICompatibleAdapterConfig.model` 改为可选；构造函数只校验 `baseURL`。请求体通过条件展开写入 `model`，避免发送 `model: undefined`。`createAgent()` 无需额外逻辑即可继承该语义。

拒绝在 Adapter 内自动选择默认模型，因为这会把 Provider/产品策略硬编码进通用协议适配器。也不新增动态 model 回调，保持本次变更最小。

## 影响范围

| 包或区域 | 文件 | 变更 |
| --- | --- | --- |
| openai-compatible | `src/OpenAICompatibleAdapter.ts`, `src/createAgent.ts`, tests | 配置和请求体语义 |
| docs | 根 README、Provider README、设计文档 | Proxy 使用说明 |

## Runtime 契约

配置契约变化：`baseURL` 唯一必填；`model?: string` 有值时作为请求体字段发送，无值时省略。服务端可忽略、覆盖、映射或拒绝该字段。消息、工具、状态、错误、取消和超时契约无变化。

## 兼容性与迁移

已有传入 `model` 的代码保持兼容。省略 `model` 是新增能力；直连严格 Provider 时可能得到 Provider 的模型缺失错误。Core 与浏览器/Node 兼容性不变。

## TDD 与验证方案

Red：新增仅 `baseURL` 配置的构造与请求测试，现有构造校验和请求体实现应失败。Green：最小修改类型、校验和条件序列化。Refactor：检查文档和错误文本一致性。运行受影响包测试、`npm run check`，并按共享公共契约要求运行 coverage 与 pack dry-run。
