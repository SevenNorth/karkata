# 实施任务：增加 Human-in-the-Loop 用户输入协议

## 任务

- [x] 1. Red：增加显式启用、特殊工具注入、请求快照、等待状态、late subscriber 和监听器隔离测试。
- [x] 2. Green：实现公共类型、`ask_user` 注入、请求订阅与最小等待/回答路径。
- [x] 3. Red：增加输入/回答校验、错误 ID、重复/迟到响应、多请求顺序、名称冲突和消息配对测试。
- [x] 4. Green：实现响应线性化、Tool Result 生成、保留名称保护和提交语义。
- [x] 5. Red：增加手动取消、整体超时、dispose、忽略取消等待及旧运行隔离测试。
- [x] 6. Green：实现所有终止路径的及时收敛与 pending request 清理。
- [x] 7. Refactor：提取特殊工具和请求生命周期逻辑，核对隔离快照及普通工具兼容路径。
- [x] 8. 更新 README 与三份设计基线，执行聚焦测试、全仓门禁、覆盖率、打包和声明检查。

## TDD 记录

| 行为 | Red 命令与失败摘要 | Green 命令与结果 | Refactor 后结果 |
| --- | --- | --- | --- |
| 特殊工具与基本等待 | `npx vitest run packages/core/src/Agent.test.ts`：新增 2 项因 `subscribeRequests` 缺失失败，其余 56 项通过 | 增加公共类型、条件工具注入、请求订阅和响应恢复后 58/58；Core 类型检查通过 | 提取 `humanInput.ts` 后 72/72 |
| 响应边界与消息配对 | 新增场景中 2 项可靠失败：回答未受长度限制、启用时未保护保留名称；其余边界已由最小等待路径通过 | 增加长度限制与构造/注册/替换保护后 64/64；Core 类型检查通过 | 共享工具结果序列化/截断后 72/72 |
| 取消、超时与迟到隔离 | 新增 5 项直接通过，证明现有可取消等待和 runId 门禁覆盖 HITL；另补配置校验 Red，3 个非法值均被接受 | 严格空对象配置校验后 72/72；Core 类型检查通过 | 提取特殊工具定义、解析和请求创建后 72/72 |

## 验证记录

| 检查 | 结果 | 备注 |
| --- | --- | --- |
| Core 聚焦测试 | 通过 | 72/72，包括等待、回答边界、多请求、取消、超时、dispose 与旧请求隔离 |
| `npm run check` | 通过 | 类型检查、3 个测试文件 104/104、三个 workspace 构建通过 |
| `npm run test:coverage` | 通过 | 行覆盖率 97.51%，分支覆盖率 89.61% |
| `npm pack --workspaces --dry-run` | 通过 | 三个包产物完整，未生成 `.tgz` |
| 声明/change/Git 检查 | 通过 | 声明符合批准契约；change 校验与 `git diff --check` 通过，变更清单无非预期文件 |

## 实施备注

- 用户已批准，当前处于 implementing。
- 规模为 8 个任务、一个生产包与文档，不建议拆分 change。
- `ask_user` 不进入 `resolveInstructions().tools`，该投影继续只描述普通 Tool Registry；特殊能力由 `humanInput` 配置表达。
