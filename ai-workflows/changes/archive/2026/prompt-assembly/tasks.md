# 实施任务：增加默认提示词与动态指导组装

## 任务

- [x] 1. Red：测试默认/静态/动态组装、每步调用、历史隔离和工具快照一致性。
- [x] 2. Red：测试 Resolver 取消收敛、错误、无效返回和长度上限。
- [x] 3. Green：实现公开类型、默认提示词、Prompt Assembler 和 Agent 集成。
- [x] 4. Refactor：收敛错误分类、冻结输入、请求组装和配置校验。
- [x] 5. 更新 README 与 Runtime、消息会话、取消设计文档。
- [x] 6. 执行全仓、覆盖率、打包、声明和 change 验证。

## TDD 记录

| 行为 | Red 命令与失败摘要 | Green 命令与结果 | Refactor 后结果 |
| --- | --- | --- | --- |
| 提示词组装与历史隔离 | 聚焦测试新增组装场景失败：只有旧静态 system 或无 system，Resolver 未调用；既有 18 个测试通过 | 实现临时 system 组装后相关测试通过 | 验证每步仅一条 system、同 runId/signal、状态和历史无 system；25/25 通过 |
| Resolver 生命周期与错误 | 取消场景提前调用 LLM，异常/超长被误分为 `MODEL_ERROR`；6 个新增测试共失败 | 加入取消竞争和专用错误后 24/24 通过 | 增加长度配置 Red/Green，最终 25/25 通过，clean typecheck 通过 |

## 验证记录

| 检查 | 结果 | 备注 |
| --- | --- | --- |
| Core 聚焦测试 | 通过 | `Agent.test.ts` 25/25 通过 |
| `npm run check` | 通过 | 全仓 3 个测试文件、29/29 测试通过，类型检查通过 |
| `npm run test:coverage` | 通过 | 全仓行覆盖率 90.37%，Core 93.19%，`prompt.ts` 100% |
| clean/build/pack dry-run | 通过 | `npm run clean`、`npm run build`、`npm pack --workspaces --dry-run` 均通过；Core 声明包含新增公开契约，内部组装器未导出 |
| change 与 Git 检查 | 通过 | `npm run ai:change:validate -- prompt-assembly` 与 `git diff --check` 通过 |

## 实施备注

- 默认提示词保持内部实现细节，不从包入口额外导出。
- 用户再次确认动态指导应拼入提示词但不在未来 UI 消息历史中回显，已作为状态与历史隔离契约测试。
