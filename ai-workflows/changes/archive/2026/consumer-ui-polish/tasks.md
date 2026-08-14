# 实施任务：完善 C 端 UI 交互

## 任务

- [x] 1. Red/Green：覆盖并实现自然运行/问题文案、空状态和默认隐藏工具。
- [x] 2. Red/Green：覆盖并实现可重试错误操作及不可重试/无候选边界。
- [x] 3. Refactor：统一提交错误处理、keyed 可见投影和旧 Store 迟到隔离。
- [x] 4. 更新 Demo、README 和 UI 设计契约。
- [x] 5. 运行 UI/SSR 聚焦测试、workspace check、覆盖率、打包预检与真实浏览器检查。

## TDD 记录

| 行为 | Red 命令与失败摘要 | Green 命令与结果 | Refactor 后结果 |
| --- | --- | --- | --- |
| C 端状态与工具展示 | `npx vitest run packages/ui/src/web-component.test.ts`：2 项因 raw 状态、缺少空状态和工具始终显示而失败 | 同命令：7 项通过；UI typecheck 通过 | 7 项通过 |
| 可重试错误 | `npx vitest run packages/ui/src/web-component.test.ts`：3 项因缺少 retry 和可配置失效回答文案而失败 | 同命令：9 项通过；UI typecheck 通过 | UI 聚焦 23 项与 workspace 154 项通过 |

## 验证记录

| 检查 | 结果 | 备注 |
| --- | --- | --- |
| UI/SSR 聚焦测试 | 通过 | UI 23 项，Demo 6 项，UI typecheck 通过 |
| `npm run check` | 通过 | 154 项测试，全量 typecheck 与 build 通过 |
| `npm run test:coverage` | 通过 | 全仓行覆盖 94.38%，UI 行覆盖 91.3% |
| `npm pack --workspaces --dry-run` | 通过 | 4 个 workspace 包预检成功 |
| Edge 桌面/390px | 通过 | 完整消息/问答流程，工具默认隐藏，无重叠或横向溢出 |

## 实施备注

- retry 仅重新提交同一失败 run 中的普通用户消息，保留当前草稿。
- 没有引入全局 submit pending；控件仍以最新 Store 状态和 composer 决定可用性。
