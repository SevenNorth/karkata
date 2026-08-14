# 实施进度：增加流式回答 UI 投影

## 当前状态

- 当前任务：完成验收与归档
- TDD 阶段：Refactor 与全量验证完成
- 最后完成：全部自动化门禁和桌面/窄屏浏览器检查
- 阻塞项：无

## 已修改文件

- `ai-workflows/changes/active/streaming-ui-projection/*`
- `packages/ui/src/types.ts`
- `packages/ui/src/AgentUIStore.ts`
- `packages/ui/src/AgentUIStore.test.ts`
- `packages/ui/src/web-component.ts`
- `packages/ui/src/web-component.test.ts`
- `examples/ui-demo/demo-agent.mjs`
- `examples/ui-demo/demo-agent.test.mjs`
- `README.md`
- `docs/design/Karkata UI 交互契约.md`
- `docs/design/Karkata无头智能体运行时设计.md`
- `docs/design/Karkata消息与会话协议.md`

## 关键决策

- partial 作为普通 Assistant message item 投影，不在顶层复制 Core partial。
- 所有 message item 使用必填 `contentStatus: complete | streaming | incomplete`，避免自定义 UI 猜测。
- 同一 `runId + step` 保持稳定 item ID；完整响应原位提升并继续投影 Tool Call。
- 失败、中止和 dispose 保留已显示文本为 incomplete；clearHistory 清空。
- Core/Provider 契约不变，Demo 使用确定性 fake partial。
- Core 限频可能使最后可见 partial 只是最终文本前缀；Store 原位补齐合法前缀，不要求公开快照与最终文本完全相等。
- 同一步非累计回退被忽略，不改写用户已看到的内容。

## 验证记录

- Store 初始 Red：6 failed、13 passed；Green/Refactor 后 19 passed。
- Web Component 流式 DOM Red 因缺少状态属性失败；Green 后 UI 全包 30 passed。
- Demo Red：2 failed、1 passed；Green 后 Demo Agent 3 passed、Demo 全部 6 passed。
- UI package typecheck 通过。
- `npm run check` 通过：6 个测试文件、182 项测试，全部 workspace 构建通过。
- `npm run test:coverage` 通过：statements 90.52%、branches 85.72%、functions 91.18%、lines 94.45%。
- `npm pack --workspaces --dry-run` 通过，四个 workspace 包内容正常。
- Edge 151 在 1280×800 与 390×844 视口验证流式 item；无横向溢出或消息/输入区重叠。
- 390px 流式中停止后，同一 `ui-4` 从 `message-streaming` 转为 `message-incomplete`，`runStatus` 为 aborted。

## 下一步

- 校验 change，流转为 completed 并归档。
