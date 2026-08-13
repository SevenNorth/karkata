# 实施进度：约束工具返回值契约

## 当前状态

- 当前任务：已完成并归档
- TDD 阶段：完成
- 最后完成：全仓测试、覆盖率、干净构建、打包、声明与 change 验证
- 阻塞项：无

## 已修改文件

- `ai-workflows/changes/archive/2026/tool-output-contract/*`
- `packages/core/src/types.ts`
- `packages/core/src/toolOutput.ts`
- `packages/core/src/Agent.test.ts`
- `packages/core/type-tests/tool-output.ts`
- `packages/core/tsconfig.type-tests.json`
- `packages/core/package.json`
- `packages/javascript/src/createUnsafeJavaScriptTool.ts`
- `packages/javascript/src/createUnsafeJavaScriptTool.test.ts`
- `package.json`
- `README.md`
- `docs/design/Karkata无头智能体运行时设计.md`
- `docs/design/Karkata工具注册与版本一致性.md`

## 关键决策

- 成功工具必须显式返回 JSON 风格 `ToolOutput`。
- `void` 和 `undefined` 在类型层不合法，不静默视为成功。
- 纯操作工具返回最小确认对象；敏感业务结果先映射再返回。
- Runtime 序列化检查继续作为类型绕过和循环引用的最终防线。

## 验证记录

- 可靠 Red：专用 `tsc` 类型测试报告 `ToolOutput` 未导出，并报告两个 `@ts-expect-error` 未使用，证明旧契约接受 `undefined`/`void`。
- Core Green：新增 `ToolOutput` 和泛型约束后专用类型测试通过。
- Core Refactor：聚焦运行时测试 27/27，通过结构化输出序列化和循环引用错误回归。
- 全仓 typecheck：失败于 `@karkata/javascript` 的 `Tool<..., unknown>` 与 `Promise<unknown>`，确认动态执行边界必须同步收紧。
- 用户重新批准跨包修订方案后，JavaScript 动态输出 Red 为 5 项失败、3 项既有/合法场景通过；Green 后扩展至 10/10 通过。
- 类型 Refactor：发现索引签名会误拒绝命名业务 DTO，改为 `defineTool()` 递归条件校验；正负例均通过。
- Core 最终防线 Red：非有限数字、class 实例和 symbol 属性发生静默变形；增加运行时校验后 Core 30/30 通过。
- 根 `typecheck` 已包含专用类型契约测试，避免类型负例仅在手工聚焦命令中运行。
- 全仓门禁：3 个测试文件 44/44、类型检查和三个 workspace 构建通过。
- 覆盖率：全仓行覆盖率 92.13%。
- 发布检查：顺序执行 clean/check/coverage/pack dry-run 通过，三个包产物完整。
- 声明检查：Core 公开 `ToolOutput` 和受约束 `defineTool()`；JavaScript 工具返回 `ToolOutput`。
- change 校验与 `git diff --check` 通过。

## 下一步

- 无。
