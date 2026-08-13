# 实施进度：支持构造时批量配置工具

## 当前状态

- 当前任务：完成并归档 change
- TDD 阶段：Refactor 完成
- 最后完成：构造初始化实现、13 个聚焦测试和文档同步
- 阻塞项：无

## 已修改文件

- `ai-workflows/changes/active/initial-tools-config/*`
- `packages/core/src/types.ts`
- `packages/core/src/ToolRegistry.ts`
- `packages/core/src/Agent.ts`
- `packages/core/src/Agent.test.ts`
- `README.md`
- `docs/design/Karkata无头智能体运行时设计.md`
- `docs/design/Karkata工具注册与版本一致性.md`

## 关键决策

- 普通 Tool 默认属于 `global`，注册项可指定任意非空 scope。
- 初始化批次原子校验和提交，不循环产生部分注册。
- 不增加内置工具、禁用语义或增量批量追加 API。
- 原子批量能力收敛到 Registry 构造初始化，避免公开类意外获得运行时 `registerMany()`。

## 验证记录

- Red：4 个新增行为测试失败，既有 7 个测试通过。
- Green：聚焦测试 11/11 通过，clean 后 typecheck 通过。
- Refactor：增加空 scope 和构造冲突测试，聚焦测试 13/13 通过。
- 最终 `npm run check`：3 个文件、17 个测试通过，typecheck 和构建通过。
- 最终覆盖率：总行覆盖率 82.44%，Core 行覆盖率 83.57%。
- clean/build/pack dry-run：三个 workspace 通过，新公共配置类型进入 Core 声明产物。
- change 校验和 `git diff --check`：通过。

## 下一步

- 流转 completed 并归档；等待用户决定是否提交。
