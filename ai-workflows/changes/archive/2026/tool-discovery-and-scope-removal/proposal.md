# 变更提案：增加工具查询与作用域移除接口

## 背景

Agent 已支持构造期工具配置、逐个注册和按 scope 原子替换，但使用方无法查询当前工具或 scope，也没有语义明确的整组移除 API。`replaceToolScope(scope, [])` 可以达到删除效果，但不直观且不返回删除数量。

用户接受增加最小查询和管理接口，并确认 `listToolScopes()` 用于查看当前有哪些 scope；`global` 只是默认 scope，不需要特殊保护。

## 目标

- 提供当前工具的只读信息列表，并支持按 scope 过滤。
- 提供 Registry 中所有已创建的 scope 列表，包括空 scope。
- 提供整组删除 API，返回删除的工具数量。
- 所有 scope 包括 `global` 采用一致语义。

## 范围

- 新增公开 `RegisteredToolInfo` 类型。
- 新增 `Agent.listTools()`、`Agent.listToolScopes()` 和 `Agent.removeToolScope()`。
- 在 Tool Registry 中实现只读投影查询与原子 scope 删除。
- 增加构造工具、运行时热插拔、过滤、删除和 dispose 边界测试。
- 更新 README 与两份工具相关设计基线。

## 非目标

- 不提供 `getTool()` 或 `hasTool()`。
- 不暴露工具 `execute`、`registrationId`、内部 Map 或可变注册记录。
- 不引入 scope 权限、锁定或 `global` 特权。
- 不改变正在执行工具的取消语义。

## 验收标准

- [x] `listTools()` 返回当前所有工具的只读信息快照，可按 scope 过滤。
- [x] 工具信息只包含 `name`、`description` 和 `scope`。
- [x] `listToolScopes()` 返回所有已创建 scope，包括空 scope，且不包含已显式删除 scope。
- [x] `replaceToolScope(scope, [])` 创建或保留空 scope，不隐式删除 scope。
- [x] `removeToolScope()` 原子删除 scope 及其中工具，返回删除数量；空或不存在 scope 均返回 `0`。
- [x] `global` 可通过 `removeToolScope('global')` 删除。
- [x] Agent dispose 后三个新 API 均遵循现有不可用约束。

## 风险

- scope 具有独立生命周期，需要 Registry 额外维护 scope 集合，并确保工具写操作与 scope 状态一致。
- 删除 scope 会使该 scope 的旧工具快照失效；已通过执行前校验的工具仍按既有线性化语义继续执行。

## 待确认项

- 无。用户已接受建议并要求实施。
