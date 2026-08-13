# 实施任务：增加上下文预算与占用状态

## 任务

- [x] 1. Red：增加预算配置、最小公开状态、完整请求估算、边界值、超限和多步增长测试。
- [x] 2. Green：实现公共类型、构造校验、调用前预算检查和 `CONTEXT_LIMIT_EXCEEDED`。
- [x] 3. Red：增加估算失败、非法值、取消、超时、迟到隔离、usage 不累计和 `clearHistory()` 测试。
- [x] 4. Green：实现安全估算错误、可取消等待与生命周期状态语义。
- [x] 5. Refactor：提取预算检查，冻结估算 context，并核对唯一请求对象和声明。
- [x] 6. 更新 README 与受影响的设计基线。
- [x] 7. 执行聚焦测试、全仓 check、覆盖率、打包预检、change 与 Git 检查。

## TDD 记录

| 行为 | Red 命令与失败摘要 | Green 命令与结果 | Refactor 后结果 |
| --- | --- | --- | --- |
| 预算与公开状态 | `npx vitest run packages/core/src/Agent.test.ts`：新增 4 项全部失败，状态字段/估算调用不存在，超限落入 `MODEL_ERROR`，多步未重估 | 增加公共类型、构造校验和调用前检查后 Core 42/42，Core 类型检查通过 | 冻结预算路径的请求/context，未配置路径保持原行为；Core 55/55，全仓 typecheck 通过 |
| 取消、失败与生命周期 | 新增场景中 6 项失败：非法值/throw 错归 `MODEL_ERROR` 或超限，`clearHistory()` 未归零；取消、超时、迟到隔离、usage 不累计与快照测试已由现有原语通过 | 集中预算检查与安全错误、clearHistory 归零后 53/53；首次回归发现未配置预算多出异步边界，条件调用后恢复既有竞态测试 | 补充模型失败保留估算、状态快照、错误码基线和完整请求克隆冻结后 Core 55/55 |

## 验证记录

| 检查 | 结果 | 备注 |
| --- | --- | --- |
| Core 聚焦测试 | 通过 | 55/55，包括预算、边界、失败、取消、超时、迟到隔离和兼容路径 |
| `npm run check` | 通过 | 类型检查、3 个测试文件 87/87、三个 workspace 构建通过 |
| `npm run test:coverage` | 通过 | 行覆盖率 96.93%，分支覆盖率 87.33% |
| `npm pack --workspaces --dry-run` | 通过 | 三个包产物完整，未生成 `.tgz` |
| 声明检查 | 通过 | `ContextUsage` 仅有 maxTokens/usedTokens；预算配置和估算器已导出，TokenUsage 未进入状态 |
| change / Git 检查 | 通过 | change 最终校验与 `git diff --check` 通过 |

## 实施备注

- 当前无偏差；不公开累计 usage，不实现自动压缩。
- 仅在启用预算时克隆冻结请求并增加异步估算点；未配置预算的 Adapter 请求可变性和调用时序保持不变。
- 后续压缩复用同一请求组装/预算检查位置，但需要独立 change 定义历史配对、回滚、取消和摘要策略。
