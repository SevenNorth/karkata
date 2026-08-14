# 变更提案：增加流式回答 UI 投影

## 背景

Core 与 OpenAI-compatible 已完成流式回答基础：启用后，`AgentState.partialResponse` 按模型步骤发布累计文本，最终完整 AssistantMessage 仍只在校验成功后进入 `messages`。当前 `@karkata/ui` 只投影 `messages` 和终态 `result`，因此 Web Component 及基于 Store 的 React/Vue 界面仍要等回答完全结束才显示内容。

直接让每个 UI 自行拼接 partial 会重复实现稳定消息 ID、最终消息去重、多步 Tool Call、失败文本保留和迟到状态隔离。该语义应由框架无关 Store 统一提供，默认面板只负责 keyed 渲染。

## 目标

- 将当前步骤的 `partialResponse` 投影为消息列表中自然的 Assistant 消息，并以显式状态供自定义 UI 判断。
- 流式更新保持同一个 UI item ID，完整响应到达时原位完成，不产生重复 Assistant 消息或列表跳动。
- 已向用户展示的部分文本在失败、中止或销毁后保留为 incomplete，成功消息与模型历史契约保持不变。
- 默认 Web Component 与本地 Demo 展示真实增量效果，同时保持纯文本、安全、可访问和滚动保护。

## 范围

- `AgentUIItem` message 条目增加 `contentStatus: 'complete' | 'streaming' | 'incomplete'`。
- `AgentUIStore` 消费 `AgentState.partialResponse`，处理创建、累计更新、最终提升、多步模型调用、终止与 clear/dispose 边界。
- Web Component 对流式/未完成消息增加稳定 part、状态属性和克制的视觉反馈，不增加第二套消息列表或输入框。
- Demo fake Agent 产生确定性 partial 状态，更新 Store、组件和 Demo 测试。
- 更新 README、UI 交互契约、Runtime 设计和消息/会话协议。

## 非目标

- 不修改 Core、Provider 流协议、状态限频或输出长度配置。
- 不增加 Markdown、富文本、打字机二次动画、reasoning/thinking 或 Provider 原始 chunk 展示。
- 不把 UI 草稿写回 `AgentState.messages`、会话历史、结果、checkpoint 或持久化格式。
- 不实现多候选回答、流式 Tool Call 参数、断线自动续传或失败回答自动重试。

## 验收标准

- [x] 首个合法 partial 创建一个 `role: 'assistant'`、`source: 'conversation'`、`contentStatus: 'streaming'` 的消息条目。
- [x] 同一 `runId + step` 的累计更新只替换内容并保持 item ID 与列表位置稳定。
- [x] 完整 AssistantMessage 到达后，原流式条目原位变为 `complete`；普通最终回答和带文本 Tool Call 步骤均不重复。
- [x] 多步 Tool Call 的每个模型步骤使用独立 Assistant 条目，工具条目顺序与安全载荷边界不变。
- [x] 失败、中止或 dispose 保留已显示文本并标记 `incomplete`；没有 partial 的运行保持现有展示行为，`clearHistory()` 仍清空 transcript。
- [x] Store 绑定到进行中的流时能展示当前 partial，并保持 `historyCompleteness: 'context_only'`；runId/step 不匹配和终止后的迟到 partial 被忽略。
- [x] 所有 message 条目都提供 `contentStatus`，React/Vue 可直接按该字段呈现流式、完整和未完成状态。
- [x] Web Component 原位更新同一 DOM 消息元素，只在用户接近底部时随内容增长滚动，并以纯文本渲染内容。
- [x] Demo 可离线演示流式回答；UI 聚焦测试、SSR、`npm run check`、覆盖率、打包预检和桌面/窄屏浏览器检查通过。

## 风险

- 若用新条目显示每个 partial，会造成重复消息、滚动抖动和屏幕阅读器噪声；必须以稳定 ID 原位更新。
- Tool Call 步骤可以同时包含文本，最终消息到达时既要提升流式条目又要继续投影工具调用。
- 失败时直接删除 partial 会让用户已阅读内容突然消失；直接当成 complete 又会误导。需要独立 `incomplete` 状态。
- 初次绑定可能发生在流式运行中，已有 `messages` 只能视为不完整上下文快照，partial 则是绑定时可观察的活动投影，两者不能合并冒充完整 transcript。
- 新增 message 必填字段会要求构造 `AgentUIItem` 的 TypeScript 使用方和测试 fixture 迁移；这是显式公共契约变化，需要文档和类型门禁。
- 高频 Core 状态会引发 O(n) 快照复制和 DOM 文本更新；Core 已默认 32ms 限频，Store 必须只保留一个累计 item，不额外保存 delta 序列。

## 待确认项

- 已确认：所有 message 条目新增必填 `contentStatus`，React/Vue 无需结合 `runStatus` 猜测文本是否完整。
- 已确认：失败、中止或 dispose 后保留已显示 partial，并明确标记为 `incomplete`；只有 `clearHistory()` 才清空它。
