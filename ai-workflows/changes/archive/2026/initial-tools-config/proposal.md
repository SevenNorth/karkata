# 变更提案：支持构造时批量配置工具

## 背景

Karkata 当前只能在 `new Agent()` 后通过 `registerTool()` 逐个注册，虽然适合运行时热插拔，但常驻工具初始化存在样板代码。Page Agent 的 `customTools` 说明构造时批量装配是常见需求；Karkata 还需要保留自身的 scope 和运行时动态更新能力。

用户已接受在 `AgentConfig` 中增加初始工具，并明确 scope 只是任意非空分组键，不绑定前端路由或其他固定业务含义。

## 目标

- 允许在 `new Agent({ tools })` 时批量配置工具。
- 简单 Tool 默认注册到 `global`，注册项可以显式指定任意非空 scope。
- 初始化批次先整体校验，重复名称或无效项使构造直接失败。
- 构造完成后继续支持现有运行时注册、替换和按 scope 原子替换。

## 范围

- 新增公开 `InitialTool` 类型与 `AgentConfig.tools`。
- 复用 Tool Registry 实现构造期原子批量注册。
- 增加成功、scope、重复冲突和输入数组隔离测试。
- 更新 README 与工具注册设计基线。

## 非目标

- 不增加内置工具或 `null` 禁用语义。
- 不为 scope 预设 route、tenant、plugin 等业务语义。
- 不改变运行时 `registerTool()`、`replaceTool()` 或 `replaceToolScope()` 签名。
- 不增加构造后的增量批量追加 API。

## 验收标准

- [x] `AgentConfig.tools` 接受 Tool 或 `{ tool, scope }` 的只读数组。
- [x] 普通 Tool 默认进入 `global`，显式 scope 原样保留并可按该 scope 操作。
- [x] 同一初始化批次或不同 scope 的同名工具使构造抛出 `ToolRegistrationError`。
- [x] 初始化工具在首次模型调用中可见并可执行。
- [x] 构造后修改原数组不改变 Agent 已注册工具。
- [x] 文档明确 scope 是任意非空分组键。

## 风险

- `AgentConfig` 公共类型扩展；既有调用完全兼容。
- Tool 与注册项是结构相似的联合类型，需要使用明确的 `tool` 属性区分。

## 待确认项

- 无。用户已明确接受设计并要求开始实施。
