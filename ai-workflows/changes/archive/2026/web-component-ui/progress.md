# 实施进度：增加框架无关 Web Component UI

## 当前状态

- 当前任务：全部完成，等待归档
- TDD 阶段：Completed
- 最后完成：任务 10，文档、发布门禁与真实浏览器检查
- 阻塞项：无

## 已修改文件

- `ai-workflows/changes/active/web-component-ui/_meta.json`
- `ai-workflows/changes/active/web-component-ui/proposal.md`
- `ai-workflows/changes/active/web-component-ui/design.md`
- `ai-workflows/changes/active/web-component-ui/tasks.md`
- `ai-workflows/changes/active/web-component-ui/progress.md`
- `packages/core/src/types.ts`
- `packages/core/src/humanInput.ts`
- `packages/core/src/Agent.ts`
- `packages/core/src/Agent.test.ts`
- `packages/ui/package.json`
- `packages/ui/tsconfig.json`
- `packages/ui/src/types.ts`
- `packages/ui/src/index.ts`
- `packages/ui/src/AgentUIStore.ts`
- `packages/ui/src/AgentUIStore.test.ts`
- `packages/ui/src/web-component.ts`
- `packages/ui/src/web-component.test.ts`
- `packages/ui/src/web-component.ssr.test.ts`
- `tsconfig.json`
- `package.json`
- `package-lock.json`
- `README.md`
- `docs/design/README.md`
- `docs/design/Karkata无头智能体运行时设计.md`
- `docs/design/Karkata消息与会话协议.md`
- `docs/design/Karkata任务取消与超时协议.md`
- `docs/design/Karkata UI 交互契约.md`

## 关键决策

- 首版保持 Core 的 `AgentState.messages` 和 `AgentMessage` 契约不变。
- 明确 `AgentState.messages` 是模型上下文快照，不是稳定的用户可见聊天记录。
- `@karkata/ui` 根入口公开无 DOM 的 Store、展示条目、composer 和统一 `submit()`，供 React/Vue/原生 UI 复用。
- Store 从绑定时开始维护会话期 transcript；非空初始上下文标记为 `context_only`，不承诺恢复压缩前或刷新前记录。
- Human-in-the-Loop 问答映射为普通对话条目，回答失效时绝不自动降级为新消息。
- `HumanInputRequest` 增加原 Tool Call `callId`，问题与回答通过 request ID/callId 精确关联。
- 原 `send()` Promise 在等待回答期间保持未决，但 Store 不使用覆盖整个 Promise 的全局 pending 标志，response composer 仍可提交。
- 初始或中途绑定内容统一标记 `context_snapshot + unknown`，不得冒充完整对话。
- 原始工具 input/result 默认不进入 Store 快照或 DOM。
- Web Component 放在 `@karkata/ui/web-component`，模块可在 SSR 安全导入，注册时才要求 DOM；外部 Store 可跨视图挂载保留记录。
- 默认面板提供可替换 labels、有限 CSS variables/parts，不提供完整国际化或主题系统。
- 首版不包含框架组件、Markdown、持久化、原始工具详情或结构化表单；UI items 不作为 checkpoint 格式。

## 验证记录

- `npm test -- --run packages/core/src/Agent.test.ts`：Red 为 2 项缺少 `callId` 失败；Green 为 99 项通过。
- `npx vitest run packages/ui/src/AgentUIStore.test.ts`：Store 入口 Red 后 2 项 Green；transcript Red 2 项后共 4 项 Green。
- `npx vitest run packages/ui/src/AgentUIStore.test.ts`：问答投影 Red、迟到请求 Red 均已 Green；当前 10 项通过。
- `npx vitest run packages/ui/src`：SSR、Web Component 与迟到结果隔离 Red-Green 完成；当前 20 项通过。
- `npx tsc -p packages/ui/tsconfig.json --noEmit`：通过。
- Core/UI 聚焦验证：4 个测试文件、119 项通过；Node 对 `dist/index.js` 与 `dist/web-component.js` 的 SSR 导入通过。
- `npm run check`：6 个测试文件、151 项通过；四个 workspace 的类型检查和构建通过。
- `npm run test:coverage`：通过；总体行覆盖率 94.96%，UI 行覆盖率 92.1%。
- `npm pack --workspaces --dry-run`：四个包通过；UI 发布包共 17 个文件，无测试或演示残留。
- Edge 真实浏览器检查：1280x800 桌面与 500x844 窄屏通过；消息、工具、预算、composer 和操作按钮无重叠或横向溢出。

## 下一步

- 运行 change 校验，将状态流转为 completed 并归档。
