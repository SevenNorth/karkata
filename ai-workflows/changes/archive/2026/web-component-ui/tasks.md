# 实施任务：增加框架无关 Web Component UI

## 任务

- [x] 1. Red/Green：覆盖 Human-in-the-Loop 请求的 `callId` 快照、多个顺序请求和迟到隔离，补充 Core 公共类型及请求创建参数。
- [x] 2. Red/Green：覆盖无 DOM 根入口、Store 创建/释放、稳定快照、revision 和监听器隔离，创建 `@karkata/ui` 包骨架与最小 Store。
- [x] 3. Red/Green：覆盖空会话、非空/活动初始上下文、`context_snapshot + unknown`、历史压缩、失败/中止回滚及 clear/dispose 区分，实现会话期 transcript。
- [x] 4. Red/Green：覆盖普通消息、运行结果及 Tool Call/Result 的 pending、成功、失败和孤立结果，实现不含工具载荷的公开投影。
- [x] 5. Red/Green：覆盖 Human-in-the-Loop 普通问答消息、callId 关联、Store/外部回答、取消/超时、连续请求及不可恢复回答正文，实现问答投影。
- [x] 6. Red/Green：覆盖原 send 未决时回答、失效回答不降级、running/disposed 拒绝及多 Store 竞争，实现 composer 与统一 `submit()`。
- [x] 7. Red/Green：覆盖 SSR 安全导入、默认/自定义 tag、幂等/冲突注册、Agent/Store 所有权和断开重连，实现 Web Component。
- [x] 8. Red/Green：覆盖纯文本注入、单输入框、IME、滚动保护、长内容、labels、CSS parts 和可访问状态，实现面板交互与响应式样式。
- [x] 9. Refactor：核对快照不泄漏载荷、Store 引用稳定、旧来源隔离、上下文视觉语义和增量 keyed 渲染。
- [x] 10. 更新 README、设计基线和示例，执行 Core/UI/SSR 聚焦验证、workspace 门禁、覆盖率、打包预检及桌面/窄屏浏览器检查。

## TDD 记录

| 行为 | Red 命令与失败摘要 | Green 命令与结果 | Refactor 后结果 |
| --- | --- | --- | --- |
| 无 DOM Store 入口与生命周期 | `npx vitest run packages/ui/src/AgentUIStore.test.ts`：入口不存在，suite 加载失败 | 同命令：2 项通过；UI typecheck 通过 | 4 项通过 |
| 会话期 transcript 与上下文完整性 | 同命令：2 项因 items 为空及完整性错误失败 | 同命令：4 项通过 | 4 项通过 |
| 消息与安全工具投影 | transcript Red 同时暴露 items 为空；工具扩展测试首次通过 | 5 项通过，载荷不出现在快照 | 10 项通过 |
| composer、提交与 Human-in-the-Loop | 7 项中 1 项因问题未进入 transcript 失败；迟到新请求随后独立 Red 失败 | 问答 Green 后 7 项通过；迟到请求 Green 后 8 项通过 | 10 项通过 |
| Web Component 注册、绑定与交互 | 入口缺失导致 2 个 suite 加载失败；交互 Red 2 项失败；旧 Store 迟到结果 Red 1 项失败 | 注册 Green 3 项；交互 Green 4 项；迟到结果 Green 6 项 | UI 全部 20 项通过 |
| HumanInputRequest callId 关联 | `npm test -- --run packages/core/src/Agent.test.ts`：2 项因请求缺少 `callId` 失败 | 同命令：99 项通过 | 99 项通过 |

## 验证记录

| 检查 | 结果 | 备注 |
| --- | --- | --- |
| Core/UI、Node/SSR 导入、DOM 聚焦测试与类型检查 | 通过 | Core/UI 共 119 项；UI typecheck 与两个发布入口的 Node 导入通过 |
| `npm run check` | 通过 | 6 个测试文件、151 项测试，四个 workspace 类型检查与构建通过 |
| `npm run test:coverage` | 通过 | 总体行覆盖率 94.96%，UI 行覆盖率 92.1% |
| `npm pack --workspaces --dry-run` | 通过 | UI 包 17 个发布文件，未包含测试、演示或视觉检查残留 |
| 桌面与窄屏浏览器视觉检查 | 通过 | Edge 1280x800 与 500x844；长消息、长工具名、预算和 composer 无重叠或横向溢出 |

## 实施备注

按批准设计完成。Windows Edge 命令行截图在小于约 500px 时会以 500px CSS 视口布局后裁切图像，因此真实浏览器窄屏检查采用 500x844；更窄布局的样式、长内容和单 composer 行为由 happy-dom 契约测试覆盖。
