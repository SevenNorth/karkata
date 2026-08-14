# 变更提案：完善 C 端 UI 交互

## 背景

默认 `<karkata-panel>` 已能完成消息、工具和 Human-in-the-Loop 交互，但当前直接显示 `completed`、`waiting_for_input`、`pending` 和工具协议名。这更接近开发调试界面，不符合 Karkata 主要服务 C 端用户的产品定位。错误状态也缺少明确的手动重试入口，空会话没有视觉状态。

## 目标

- 默认面板使用自然、可访问且可替换的用户文案，不暴露内部状态枚举。
- 默认隐藏工具协议条目和活动工具名称，宿主可显式开启调试展示。
- 提供空状态和仅针对可重试运行错误的重试操作。
- 保持单输入框、Human-in-the-Loop 路由、取消和 Store 安全边界不变。

## 范围

- 扩展 `KarkataPanelLabels`，覆盖运行状态、问题状态、工具状态、空状态、重试和本地错误文案。
- `KarkataPanelElement` 增加 `showTools` 布尔属性，默认 `false`。
- Web Component 增加空状态、自然状态映射和 retry icon button/part。
- 可重试错误从同一失败运行中定位最后一条普通用户消息，并经现有 `store.submit()` 重新发送。
- 更新 Demo、README 和 UI 交互设计文档。

## 非目标

- 不修改 Core、AgentUIStore、消息协议、错误码或重试分类。
- 不增加完整国际化框架、语言自动检测、Markdown、工具详情或持久化。
- 不自动重试，不重试不可重试错误，不恢复已中止的运行。
- 不改变自定义 React/Vue UI 的 Store 契约。

## 验收标准

- [x] 默认状态栏、问题提示和工具状态不显示原始枚举值。
- [x] 空记录显示可配置空状态，出现首条消息后不占据消息列表。
- [x] 工具条目和活动工具名默认隐藏；设置 `showTools = true` 后使用自然文案显示。
- [x] `error.retryable === true` 且能定位失败用户消息时显示可访问的重试按钮，点击通过 `store.submit()` 重新发送原消息。
- [x] 不可重试错误、无失败用户消息或非 error 状态不显示重试按钮。
- [x] 失效 Human-in-the-Loop 回答保留草稿并显示可配置自然错误文案。
- [x] 既有 labels 和 `panel.agent`/`panel.store` 用法保持兼容。
- [x] Demo 使用中文 C 端文案，桌面和 390px 窄屏无重叠或横向溢出。
- [x] UI 聚焦测试、SSR 导入、`npm run check`、覆盖率和打包预检通过。

## 风险

- labels 字段增加后构成公共 API；命名应稳定且保持 `Partial<KarkataPanelLabels>` 的向后兼容。
- retry 必须只复用安全展示记录中的普通用户文本，不能重放 Human-in-the-Loop 回答、工具载荷或上下文快照。
- 隐藏工具只是展示策略，不改变 Store 快照；有调试需求的宿主必须可显式恢复展示。
- 重试仍是一次全新的运行，不能暗示外部工具副作用会被回滚或幂等处理。

## 待确认项

- 用户已批准以 C 端体验为下一项工作；无其他待确认项。
