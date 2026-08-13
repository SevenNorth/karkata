# 技术设计：支持构造时批量配置工具

## 现状分析

已阅读 `types.ts`、`Agent.ts`、`ToolRegistry.ts`、相邻测试、公开入口和设计文档。Agent 持有私有 Registry；单个注册和 `replaceScope` 都在 Registry 内校验。当前构造函数只归一化运行参数与 system prompt，没有初始工具入口。

## 方案

新增：

```ts
export interface ScopedInitialTool {
  readonly tool: Tool
  readonly scope: string
}

export type InitialTool = Tool | ScopedInitialTool

export interface AgentConfig {
  tools?: readonly InitialTool[]
}
```

Tool Registry 构造函数接受初始注册项：先在局部 Map 中对整个输入批次执行与单个注册相同的校验和全局名称唯一检查，全部通过后才赋给内部记录。Agent 构造函数把普通 Tool 规范化为默认 `global`，把注册项的 scope 原样传入。Registry 只保存新的注册记录，不保存配置数组，因此调用方后续修改数组不会影响 Agent。该方案不新增构造后的增量批量注册方法。

不采用构造函数循环调用公开 `register()`，因为后项失败会在内部产生部分注册，且语义不是原子批次。不采用 `Record<string, Tool>`，因为 Karkata 的 Tool 自带稳定名称且数组更适合保序和显式 scope。

## 影响范围

| 包或区域 | 文件 | 变更 |
| --- | --- | --- |
| core types | `packages/core/src/types.ts` | 新增初始化注册类型和配置字段 |
| core registry | `packages/core/src/ToolRegistry.ts` | 新增原子批量注册内部能力 |
| core agent | `packages/core/src/Agent.ts` | 构造时规范化并注册初始工具 |
| core tests | `packages/core/src/Agent.test.ts` | 初始工具行为与失败场景测试 |
| docs | `README.md`、`docs/design/*` | 使用示例和 scope 通用语义 |

## Runtime 契约

- `tools` 是可选只读数组；省略时行为不变。
- `Tool` 项使用 `global` scope；`{ tool, scope }` 项使用显式非空 scope。
- scope 是不透明分组键，Core 不解析其业务含义。
- 有效工具名称跨所有 scope 仍保持全局唯一。
- 初始化批次只在全部项有效且无冲突时提交。
- 初始注册与运行时注册使用相同 `registrationId`、快照和版本一致性规则。

## 兼容性与迁移

这是向后兼容的可选配置扩展，Node 和浏览器语义一致。既有 `new Agent({ llm })` 及构造后逐个注册代码无需迁移。使用方可逐步将固定工具移入构造配置，动态工具继续使用现有 API。

## TDD 与验证方案

1. Red：新增测试，验证初始全局工具可在首次模型调用中执行、显式 scope 可被相同 scope 替换、重复名称构造失败、数组后续 push 不生效；预期因 `AgentConfig.tools` 不存在而类型检查失败或行为测试失败。
2. Green：增加类型、Registry 原子批量注册和 Agent 构造装配的最小实现。
3. Refactor：提取初始化项判别/规范化，保持 Registry 校验单一来源。
4. 验证：聚焦测试、typecheck、`npm run check`、覆盖率、workspace 打包预检、change 校验和 `git diff --check`。
