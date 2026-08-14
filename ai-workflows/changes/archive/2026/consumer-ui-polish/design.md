# 技术设计：完善 C 端 UI 交互

## 现状分析

`web-component.ts` 直接把 `AgentStatus`、tool status 和 Human-in-the-Loop request status 拼进 DOM。`KarkataPanelLabels` 只覆盖五个按钮/占位文案，错误区是纯文本节点，没有命令位。工具条目总是显示，`activeToolName` 也总是拼接到状态。Store 已提供安全、无载荷的 `items`、`error.retryable` 和每个消息的 `runStatus`，因此本变更可完全留在 Web Component 展示层。

## 方案

扩展 flat labels，新增 `retry`、`empty`、七种运行状态、两种问题状态、三种工具状态、`responseRejected` 和 `operationFailed`。继续使用 `Partial<KarkataPanelLabels>` 合并不可变默认值，既有 labels 对象无需迁移。

`showTools` 默认 `false`。关闭时，渲染投影过滤 `tool` items，并且状态栏不附加 `activeToolName`；Store 快照不变。开启时按原 keyed DOM 机制恢复条目，状态显示 `工具名称 · 本地化工具状态`。

消息区维护一个稳定的 empty 元素；仅在可见 items 为空时显示。Human-in-the-Loop 问题的 pending/cancelled 使用 labels，不再输出协议枚举。

错误区改为文本与 retry icon button 的并列区域。只有当前状态为 `error`、`error.retryable` 为真，且能从后向前找到 `source: 'conversation'`、`role: 'user'`、`runStatus: 'error'` 的消息时显示 retry。点击后以该文本调用现有 `store.submit()`，形成全新运行；不复用 request ID，不重放工具或 Human-in-the-Loop 数据。运行状态同步变化后按钮自然隐藏，Core/Store 继续负责并发门禁和结果隔离。

## 影响范围

| 包或区域 | 文件 | 变更 |
| --- | --- | --- |
| Web Component | `packages/ui/src/web-component.ts` | labels、showTools、空状态、自然状态和 retry |
| UI 测试 | `packages/ui/src/web-component.test.ts` | C 端展示与重试契约 |
| Demo | `examples/ui-demo/app.mjs` | 中文 labels，默认终端用户展示 |
| 文档 | `README.md`、`docs/design/Karkata UI 交互契约.md` | 新属性、parts 与展示边界 |
| change | `ai-workflows/changes/active/consumer-ui-polish/*` | 审批与验证证据 |

## Runtime 契约

Core 和 AgentUIStore 契约均不变化。retry 是 Web Component 发起的一次普通 `store.submit(message)`；旧运行保持 error，新的运行由 Core 分配新 runId。隐藏工具仅影响 DOM，不修改 Store 快照或模型上下文。

## 兼容性与迁移

`KarkataPanelLabels` 增加字段，但属性类型仍为 `Partial<KarkataPanelLabels> | null`，已有覆盖继续生效。`showTools` 是新增属性且默认关闭，这是默认视觉行为变化；需要原工具列表的宿主设置 `panel.showTools = true`。新增 `empty` 和 `retry` parts，不移除既有 parts。

## TDD 与验证方案

1. Red：默认空状态、自然运行/请求文案和默认隐藏工具测试因当前 raw 输出失败。
2. Green：扩展 labels、showTools 与 keyed 可见投影。
3. Red：可重试错误按钮和重发原消息测试因控件不存在失败；覆盖不可重试、错误消息缺失和 Store 替换隔离。
4. Green：实现 retry 候选定位、图标按钮和复用提交路径。
5. 更新 Demo/文档，运行 UI 聚焦测试、SSR、workspace check、覆盖率、pack dry-run，并用 Edge 验证桌面和 390px 流程。
