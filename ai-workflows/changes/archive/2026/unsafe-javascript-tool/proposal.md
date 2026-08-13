# 变更提案：明确非沙箱 JavaScript 工具 API

## 背景

`@karkata/javascript` 当前导出 `createJavaScriptTool()`，但实现通过 `AsyncFunction` 在宿主当前 JavaScript Realm 中直接执行代码，并不提供安全隔离。现有名称没有在调用点清楚表达这一安全边界，容易让使用方误认为它适合执行不可信的 LLM 输出。

用户已明确确定当前边界：该包继续作为可选 JavaScript 执行工具，但公开工厂仅保留 `createUnsafeJavaScriptTool()`，不保留 `createJavaScriptTool()` 兼容别名；隔离 sandbox 暂不实施。

## 目标

- 将唯一公开工具工厂改名为 `createUnsafeJavaScriptTool()`。
- 从源码和包导出中彻底移除 `createJavaScriptTool()`。
- 在代码、测试和设计文档中统一说明当前 Realm 执行及非沙箱边界。

## 范围

- 修改 `@karkata/javascript` 的实现文件、公共导出和单元测试。
- 更新根 README、AGENTS 约束和 Karkata 运行时设计文档中的 API 名称及安全说明。
- 记录破坏性迁移方式并验证包产物不再导出旧符号。

## 非目标

- 不实现 QuickJS、Worker、iframe、Node `vm` 或其他隔离 sandbox。
- 不改变脚本执行语义、globals 注入方式、取消语义或工具默认名称。
- 不让 Core 自动注册或执行 JavaScript 工具。
- 不保留旧 API 的运行时或类型兼容别名。

## 验收标准

- [x] `@karkata/javascript` 仅导出 `createUnsafeJavaScriptTool()` 和对应选项类型。
- [x] 旧的 `createJavaScriptTool` 在生产源码、类型声明和构建产物中均不存在。
- [x] 新工厂保持现有显式 globals、异步执行和取消检查行为。
- [x] README、仓库约束与设计基线明确该工具不是安全沙箱。
- [x] JavaScript 聚焦测试、全仓检查、覆盖率和 workspace 打包预检通过。

## 风险

- 这是有意的破坏性公共 API 变更，现有使用方必须将导入和调用迁移为 `createUnsafeJavaScriptTool()`。
- 改名只提高安全语义可见性，不改变当前 Realm 执行代码的实际风险。

## 待确认项

- 无。用户于 2026-08-13 明确批准“不保留 `createJavaScriptTool`，进行实施”。
