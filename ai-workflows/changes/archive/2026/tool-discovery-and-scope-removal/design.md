# 技术设计：增加工具查询与作用域移除接口

## 现状分析

Agent 的 Registry 是私有字段。公开的 `ToolRegistry.snapshot()` 包含 registrationId 和 Tool.execute，属于内部执行一致性数据，不适合直接转交宿主。`replaceScope(scope, [])` 能删除整组工具，但总会增加 revision，且 Agent API 无法返回实际删除数。

## 方案

公开类型：

```ts
export interface RegisteredToolInfo {
  readonly name: string
  readonly description: string
  readonly scope: string
}
```

Agent API：

```ts
listTools(options?: { scope?: string }): readonly Readonly<RegisteredToolInfo>[]
listToolScopes(): readonly string[]
removeToolScope(scope: string): number
```

Registry 独立维护按创建顺序排列的 scope Set。`global` 在 Registry 构造时创建；构造注册、`register()` 和 `replaceScope()` 会创建对应 scope。删除单个工具或清空 scope 不删除 scope；只有 `removeScope()` 删除 scope 实体及其中所有工具。

Registry 查询遍历当前工具 Map，创建并冻结新的信息对象与结果数组。`listTools({ scope })` 对空白 scope 抛 `ToolRegistrationError`，不传 scope 返回全部。`listToolScopes()` 返回 scope Set 的冻结数组，包括空 scope。删除先校验非空 scope；不存在返回 `0` 且不修改 revision，存在时删除 scope 和其中工具，一次提交并增加一次 revision。空 scope 删除成功也返回 `0`，调用方通过删除前后的 scope 列表区分它与不存在 scope。

## 影响范围

| 包或区域 | 文件 | 变更 |
| --- | --- | --- |
| core types | `packages/core/src/types.ts` | 新增公开工具信息投影 |
| core registry | `packages/core/src/ToolRegistry.ts` | 查询投影、scope 列表和原子删除 |
| core agent | `packages/core/src/Agent.ts` | 暴露三个受 dispose 保护的 API |
| core tests | `packages/core/src/Agent.test.ts` | 查询、过滤、只读、删除和失效测试 |
| docs | `README.md`、`docs/design/*` | API 示例与 scope 生命周期语义 |

## Runtime 契约

- 查询反映调用时的当前注册状态，包括构造工具与运行时热插拔结果。
- 查询数组和每个信息对象均冻结；后续 Registry 更新不会回写旧查询结果。
- 查询不暴露 execute、inputSchema、registrationId 或内部 Map。
- `listToolScopes()` 返回所有已创建 scope，包括空 scope，并保持创建顺序。
- `global` 在 Agent 构造时创建，即使没有工具也会出现在 scope 列表中。
- 单个工具注销和 `replaceToolScope(scope, [])` 不删除 scope；只有 `removeToolScope()` 删除 scope 实体。
- scope 名称不具有业务预设；`global` 与其他 scope 一样可删除。
- 删除 scope 会使尚未越过执行前版本检查的旧快照产生 `TOOL_CHANGED`。
- Agent disposed 后查询和删除方法抛 `AgentDisposedError`。

## 兼容性与迁移

新增方法和类型向后兼容。Node 与浏览器均只使用 Map、Set 和 Object.freeze。现有 `replaceToolScope(scope, [])` 保持可用，`removeToolScope()` 是更明确且可返回删除数量的替代入口。

## TDD 与验证方案

1. Red：新增测试覆盖精简投影、scope 过滤、快照隔离、空 scope 生命周期、global 删除、空/不存在 scope 和 disposed 约束，预期因方法不存在失败。
2. Green：实现公开类型、Registry 查询/删除和 Agent 转发。
3. Refactor：复用统一 scope 校验，保证返回投影不携带内部字段，并检查 scope Set 与工具 Map 一致性。
4. 验证：聚焦测试、clean typecheck、全仓 check、覆盖率、打包预检、声明扫描、change 和 Git 检查。
