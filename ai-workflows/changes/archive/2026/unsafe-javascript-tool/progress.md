# 实施进度：明确非沙箱 JavaScript 工具 API

## 当前状态

- 当前任务：完成并归档 change
- TDD 阶段：Red-Green-Refactor 完成
- 最后完成：全仓、覆盖率、打包和发布产物验证
- 阻塞项：无

## 已修改文件

- `ai-workflows/changes/active/unsafe-javascript-tool/*`
- `packages/javascript/src/createUnsafeJavaScriptTool.ts`
- `packages/javascript/src/createUnsafeJavaScriptTool.test.ts`
- `packages/javascript/src/index.ts`
- `README.md`
- `AGENTS.md`
- `docs/design/Karkata无头智能体运行时设计.md`

## 关键决策

- 只保留 `createUnsafeJavaScriptTool()`，不提供旧 API 别名。
- 保持当前 Realm 执行行为不变，sandbox 留待独立变更。
- 用户于 2026-08-13 已明确批准边界并要求实施。

## 验证记录

- Red：新公共入口调用失败，`createUnsafeJavaScriptTool is not a function`。
- Green：聚焦测试 1/1 通过。
- Refactor：聚焦测试 2/2 通过，JavaScript 包 typecheck 通过。
- `npm test --workspace @karkata/javascript` 因既有测试路径配置未找到测试；改用根目录精确路径验证。
- `npm run check`：3 个测试文件、11 个测试通过，typecheck 和构建通过。
- `npm run test:coverage`：通过，JavaScript 源文件行覆盖率 100%。
- 串行 clean、build、pack dry-run：通过，发布包只包含新 API 产物。
- `git diff --check`：通过。

## 下一步

- 最终校验 change，流转 completed 并归档。
