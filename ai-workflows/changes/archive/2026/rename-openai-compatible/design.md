# 设计：重命名 OpenAI 兼容协议包

## 现状分析

Provider 包名为 `@karkata/openai`，但实现只依赖 OpenAI-compatible `/chat/completions` 协议和可配置 `baseURL`。包名、类名与实际边界不够准确。当前便捷工厂变更尚未发布，因此可以在发布前整体收敛命名。

## 方案

采用一次性机械与语义重命名：

| 旧名称 | 新名称 |
| --- | --- |
| `packages/openai` | `packages/openai-compatible` |
| `@karkata/openai` | `@karkata/openai-compatible` |
| `OpenAIAdapter` | `OpenAICompatibleAdapter` |
| `OpenAIAdapterConfig` | `OpenAICompatibleAdapterConfig` |
| `OpenAICreateAgentConfig` | `OpenAICompatibleCreateAgentConfig` |
| `createAgent` | `createAgent` |

不增加 deprecated re-export。历史 change 归档保留当时名称，新的 change 记录演进原因；当前源码、仓库约束和设计基线必须只使用新名称。

## Runtime 契约

Runtime 行为不变：

```text
@karkata/core                       @karkata/openai-compatible
Agent + LLMAdapter  <-------------- OpenAICompatibleAdapter
                                    createAgent(config) -> Agent
```

新包仍请求 `${baseURL}/chat/completions`，归一化 OpenAI 风格消息、Tool Call 与 usage。Core 不识别 Provider 名称。

## 兼容性与迁移

项目尚未发布，不保留旧包或旧导出。仓库内全部调用一次性迁移。未来若正式发布后再重命名，必须采用弃用周期或兼容包。

## TDD 与验证方案

- Red：先将测试改为只引用新公开名称，确认旧实现无法编译或导入。
- Green：重命名目录、源码、包清单与入口，使聚焦测试恢复通过。
- Refactor：更新 workspace 配置、lockfile、别名、约束和设计文档，并全仓检索旧名称。
- 验证：全仓 check、coverage、workspace pack dry-run、声明检查、change 校验和 Git 空白检查。

## 影响范围

- `packages/openai-compatible/**`
- `package-lock.json`
- `tsconfig.json`
- `vitest.config.ts`
- `scripts/clean.mjs`
- `AGENTS.md`
- `README.md`
- `docs/design/Karkata无头智能体运行时设计.md`
