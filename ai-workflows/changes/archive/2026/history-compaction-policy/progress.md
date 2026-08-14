# 实施进度：增加历史摘要与裁剪策略

## 当前状态

- 当前任务：全部完成
- TDD 阶段：完成
- 最后完成：任务 9，全部验证门禁通过
- 阻塞项：无

## 已修改文件

- `ai-workflows/changes/active/history-compaction-policy/proposal.md`
- `ai-workflows/changes/active/history-compaction-policy/design.md`
- `ai-workflows/changes/active/history-compaction-policy/tasks.md`
- `ai-workflows/changes/active/history-compaction-policy/progress.md`
- `packages/core/src/Agent.test.ts`
- `packages/core/src/Agent.ts`
- `packages/core/src/history.ts`
- `packages/core/src/types.ts`
- `README.md`
- `docs/design/Karkata无头智能体运行时设计.md`
- `docs/design/Karkata消息与会话协议.md`
- `docs/design/Karkata任务取消与超时协议.md`

## 关键决策

- Core 负责阈值、候选验证、预算重检、原子提交、取消和迟到隔离。
- 宿主注入 `compactHistory`，可实现直接裁剪或显式调用模型生成摘要；Core 不内置摘要模型和 Prompt。
- 首版只接受可归一化为 `AgentMessage[]` 的候选历史，不支持 Provider 不透明压缩项。
- 当前运行消息不参与压缩；候选历史仅在运行成功时提交。

## 验证记录

- 变更规模评估：9 个实施任务，影响 Core 与设计文档；未达到必须拆分阈值。
- Red：`npx vitest run packages/core/src/Agent.test.ts`，75 项中 2 项失败；压缩回调未触发、非法配置未拒绝，失败原因与目标行为一致。
- Green：`npx vitest run packages/core/src/Agent.test.ts`，75/75 通过；压缩配置、阈值触发、冻结历史、候选重估和等值边界通过。
- Red：`npx vitest run packages/core/src/Agent.test.ts`，83 项中 7 项失败；回调异常和 6 类非法候选未按安全压缩错误处理，目标未达成测试已通过。
- Green：新增独立历史校验和安全错误映射后 Core 83/83；`npm run typecheck` 通过。
- 生命周期：新增当前运行隔离、多步复用、成功提交、模型失败回滚、取消/迟到和超时测试；既有实现与取消原语直接满足，Core 88/88。
- Refactor：为 null 压缩配置增加稳定错误，Red 为底层属性访问错误、Green 后 Core 89/89；直接裁剪场景通过，摘要示例改为普通 user 权限；`npm run typecheck` 通过。
- 最终 Core 聚焦测试 99/99；`npm run check` 通过，3 个测试文件 131/131，三个 workspace 构建通过。
- `npm run test:coverage` 通过：行 97.47%、分支 91.14%；`history.ts` 行覆盖率 94.59%。
- `npm pack --workspaces --dry-run` 通过，三个包产物完整且未生成 `.tgz`。
- `npm run ai:change:validate -- history-compaction-policy` 与 `git diff --check` 通过。

## 下一步

- 流转 completed 并归档 change；不自动创建 Git commit。
