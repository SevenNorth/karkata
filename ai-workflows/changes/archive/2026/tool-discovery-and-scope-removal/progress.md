# 实施进度：增加工具查询与作用域移除接口

## 当前状态

- 当前任务：完成并归档 change
- TDD 阶段：Refactor 完成
- 最后完成：三个公开 API、空 scope 生命周期、只读投影和文档同步
- 阻塞项：无

## 已修改文件

- `ai-workflows/changes/active/tool-discovery-and-scope-removal/*`
- `packages/core/src/types.ts`
- `packages/core/src/ToolRegistry.ts`
- `packages/core/src/Agent.ts`
- `packages/core/src/Agent.test.ts`
- `README.md`
- `docs/design/Karkata无头智能体运行时设计.md`
- `docs/design/Karkata工具注册与版本一致性.md`

## 关键决策

- 只提供 `listTools()`、`listToolScopes()` 和 `removeToolScope()`。
- `global` 与所有其他 scope 语义一致，可以整体删除；Registry 初始包含空的 `global` scope。
- 查询返回冻结投影，只包含名称、描述和 scope。
- scope 有独立生命周期，清空工具不删除 scope，只有 `removeToolScope()` 删除 scope 实体。

## 验证记录

- 修订后 Red：5 个新增测试失败，既有 13 个测试通过。
- Green：聚焦测试 18/18 通过，clean typecheck 通过。
- Refactor：投影移除 Schema，补充空 scope 保留测试，聚焦测试 18/18 通过。
- `npm run check`：3 个文件、22 个测试通过，typecheck 和构建通过。
- 覆盖率：总行覆盖率 88.09%，Core 行覆盖率 90.74%。
- clean/build/pack dry-run：通过；声明产物包含三个 API，`RegisteredToolInfo` 仅有三个字段。
- change 校验和 `git diff --check`：通过。

## 下一步

- 流转 completed 并归档；等待用户决定是否提交。
