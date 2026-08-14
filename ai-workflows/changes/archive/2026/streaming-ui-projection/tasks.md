# 实施任务：增加流式回答 UI 投影

## 任务

- [x] 1. Red/Green：为所有 message item 增加 `contentStatus`，实现首个 partial 与同一步累计稳定更新。
- [x] 2. Red/Green：最终回答和带文本 Tool Call 原位提升，覆盖无 partial 兼容及多步骤独立条目。
- [x] 3. Red/Green：error/abort/dispose 保留 incomplete，clear 清空，并隔离不匹配和迟到 partial。
- [x] 4. Red/Green：Store 在进行中流式状态初始化时建立 context_only 与后续结算边界。
- [x] 5. Red/Green：Web Component 原位 DOM 更新、状态 part/class、纯文本和滚动保护。
- [x] 6. Red/Green：Demo fake Agent 发布确定性累计 partial，并更新 Demo 测试。
- [x] 7. Refactor：整理消息提升与结算逻辑，复查 Human-in-the-Loop、工具载荷和快照隔离。
- [x] 8. 更新 README、UI 交互契约、Runtime 设计和消息/会话协议。
- [x] 9. 运行 UI/Demo 聚焦测试、SSR、全量 check、覆盖率、workspace 打包预检和桌面/窄屏浏览器检查。

## TDD 记录

| 行为 | Red 命令与失败摘要 | Green 命令与结果 | Refactor 后结果 |
| --- | --- | --- | --- |
| Store 增量消息与最终提升 | `npx vitest run packages/ui/src/AgentUIStore.test.ts`：6 failed、13 passed；Store 忽略 partial | 同命令：19 passed | 增加非累计回退隔离后持续 19 passed |
| Store 多步、终止和迟到隔离 | 同一 Red 覆盖 Tool Call 多步、error/abort/dispose 和进行中绑定 | 同命令：19 passed | UI 全包测试 30 passed |
| Web Component 与 Demo | 流式 DOM 测试因缺少 dataset/part 失败；Demo 2 failed、1 passed | Web Component 聚焦测试通过；Demo 3 passed | UI 全包 30 passed；Demo 全部 6 passed |

## 验证记录

| 检查 | 结果 | 备注 |
| --- | --- | --- |
| UI/Demo 聚焦测试 | 通过 | UI 30；Demo Agent 3；Demo 全部 6 |
| SSR 与 typecheck/build | 通过 | UI SSR 测试、package typecheck 和 workspace build 通过 |
| `npm run check` | 通过 | 6 files、182 tests；typecheck 和全部 workspace build 通过 |
| `npm run test:coverage` | 通过 | statements 90.52%、branches 85.72%、functions 91.18%、lines 94.45% |
| `npm pack --workspaces --dry-run` | 通过 | Core、JavaScript、OpenAI-compatible、UI 四个包预检通过 |
| 桌面/390px 浏览器检查 | 通过 | Edge 151；流式与中止状态无横向溢出或消息/输入区重叠，item ID 原位保持 |

## 实施备注

- 预计 9 个任务，影响 UI Store、Web Component、Demo 与文档，但共享同一 UI 验收目标，不建议继续拆 change。
- Core 与 Provider 流式基础保持冻结；若实施发现必须改变其契约，先 revise 并重新批准。
