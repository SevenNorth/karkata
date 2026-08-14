# 实施任务：增加历史摘要与裁剪策略

## 任务

- [x] 1. Red：增加压缩配置类型、构造校验、阈值触发、冻结输入、候选重估和低于阈值不调用测试。
- [x] 2. Green：实现压缩公共契约、配置校验和调用前压缩检查点。
- [x] 3. Red：增加直接裁剪、摘要消息、候选历史不变式、目标未达成和安全错误测试。
- [x] 4. Green：实现候选历史验证、目标预算门禁和 `CONTEXT_COMPACTION_ERROR`。
- [x] 5. Red：增加当前运行隔离、多步复用、成功原子提交、模型失败回滚、取消、超时和迟到结果测试。
- [x] 6. Green：实现运行级候选历史和完整生命周期语义。
- [x] 7. Refactor：整理请求组装、估算和验证结构，确认未配置路径保持原有时序。
- [x] 8. 更新 README、公共声明和受影响设计基线。
- [x] 9. 执行 Core 聚焦测试、全仓 check、覆盖率、workspace pack dry-run、change 与 Git 检查。

## TDD 记录

| 行为 | Red 命令与失败摘要 | Green 命令与结果 | Refactor 后结果 |
| --- | --- | --- | --- |
| 阈值与候选预算 | `npx vitest run packages/core/src/Agent.test.ts`：75 项中 2 项失败，回调未触发且非法配置未拒绝；等于阈值不触发已通过 | 增加公共类型、配置校验、运行级候选历史和候选重估后 75/75 通过 | 补充 null 配置 Red/Green 与直接裁剪场景后 89/89，类型检查通过 |
| 历史结构与安全错误 | `npx vitest run packages/core/src/Agent.test.ts`：83 项中 7 项失败，回调异常误归为 MODEL_ERROR，非法候选误入估算；目标预算门禁已通过 | 新增候选历史校验和压缩错误映射后 83/83，通过严格类型检查 | 独立 `history.ts` 校验结构，摘要示例保持普通 user 权限；89/89 |
| 原子提交、取消与迟到隔离 | 新增 5 项生命周期测试；基于任务 2 的运行级候选历史和既有取消原语，首次运行即全部通过 | 无需额外生产改动，Core 88/88 通过 | 直接裁剪成功提交场景补齐后 89/89 |

## 验证记录

| 检查 | 结果 | 备注 |
| --- | --- | --- |
| Core 聚焦测试 | 通过 | 99/99，覆盖阈值、裁剪、摘要、候选不变式、错误、回滚、取消、超时、dispose 和迟到隔离 |
| `npm run check` | 通过 | 类型检查、3 个测试文件 131/131、三个 workspace 构建通过 |
| `npm run test:coverage` | 通过 | 行覆盖率 97.47%，分支覆盖率 91.14%；`history.ts` 行覆盖率 94.59% |
| `npm pack --workspaces --dry-run` | 通过 | 三个包产物完整，Core 声明包含新增压缩类型；未生成 `.tgz` |
| change / Git 检查 | 通过 | change 校验和 `git diff --check` 通过 |

## 实施备注

- Provider 原生不透明 compaction item 和 Responses API Adapter 留作独立变更。
- 模型摘要示例使用普通 user 消息，避免把来源于对话的数据提升为可信 system 指令。
