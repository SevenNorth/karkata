# 技术设计：明确非沙箱 JavaScript 工具 API

## 现状分析

已阅读 `packages/javascript/src/createJavaScriptTool.ts`、相邻测试、包 `index.ts`、包清单、根 README、AGENTS 以及 `docs/design/Karkata无头智能体运行时设计.md`。当前工厂构造符合 Core `Tool` 协议的 `execute_javascript` 工具，通过 `AsyncFunction` 在当前 Realm 执行脚本，并在执行前后检查 `AbortSignal`。包只包含这一项能力。

## 方案

将实现文件、函数和选项类型统一重命名为 `createUnsafeJavaScriptTool` 与 `UnsafeJavaScriptToolOptions`，包入口只导出这两个新符号。测试首先改为从包公共入口导入新工厂，使 Red 阶段因新导出不存在而失败；随后完成最小重命名使其通过。最后扫描源码与构建产物，确认旧符号完全消失。

拒绝保留旧函数别名或 deprecated 导出，因为用户明确要求不保留。拒绝在本次引入 sandbox 抽象，因为它需要独立的威胁模型、资源限制和跨环境实现。

## 影响范围

| 包或区域 | 文件 | 变更 |
| --- | --- | --- |
| javascript | `packages/javascript/src/createUnsafeJavaScriptTool.ts` | 重命名工厂与选项类型，执行语义不变 |
| javascript | `packages/javascript/src/index.ts` | 只导出新 API |
| javascript | `packages/javascript/src/createUnsafeJavaScriptTool.test.ts` | 从公共入口验证新 API 与既有行为 |
| docs | `README.md`、`AGENTS.md` | 明确包定位和非沙箱边界 |
| design | `docs/design/Karkata无头智能体运行时设计.md` | 更新文件树、示例、交付项和安全契约 |

## Runtime 契约

- `@karkata/javascript` 唯一工厂为 `createUnsafeJavaScriptTool(options?)`。
- 选项类型为 `UnsafeJavaScriptToolOptions`。
- 不提供 `createJavaScriptTool` 或 `JavaScriptToolOptions` 兼容符号。
- 返回工具仍默认命名为 `execute_javascript`，必须由使用方显式注册。
- 脚本仍在宿主当前 Realm 执行，不提供隔离；同步死循环仍无法由 `AbortSignal` 中断。
- Core、消息、状态、取消、工具注册和错误契约无变化。

## 兼容性与迁移

浏览器和 Node 运行能力不变。使用方需要执行直接迁移：

```ts
import { createUnsafeJavaScriptTool } from '@karkata/javascript'
```

旧导入将产生 TypeScript/ESM 导出错误。这是项目 `0.1.0` 阶段经用户明确接受的破坏性变更。回滚方式是恢复本次提交，不通过兼容别名回滚。

## TDD 与验证方案

1. Red：将测试改为从包入口导入并调用 `createUnsafeJavaScriptTool()`，运行 JavaScript 包测试，预期因入口未导出新符号而失败。
2. Green：重命名实现与入口导出，保持既有脚本结果断言通过。
3. Refactor：统一文件名、类型名和文档用语，扫描并移除所有旧符号。
4. 验证：运行包测试、`npm run check`、`npm run test:coverage`、`npm pack --workspaces --dry-run`、change 校验和 `git diff --check`。
