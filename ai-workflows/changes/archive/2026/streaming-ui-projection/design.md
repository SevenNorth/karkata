# 技术设计：增加流式回答 UI 投影

## 现状分析

`AgentUIStore.#receiveState()` 会克隆 Core 状态，`#applyState()` 按运行增量投影 `messages`。活动运行的 AssistantMessage 由 `#projectObservedMessage()` 追加；最终文本因终态不再处理 `messages`，而由 `state.result.content` 追加。这样适合完整响应，但完全忽略了独立于 `messages` 的 `partialResponse`。

Store 已拥有会话期 transcript、稳定递增 item ID、runStatus 终态更新和隔离快照。Web Component 又按 item ID 缓存 DOM 元素并更新 `textContent`，因此无需新增第二种 Store、事件通道或 DOM 结构。需要补充的是“当前模型步骤草稿”与最终消息之间的一一对应关系。

Core 保证 partial 只属于当前 `runId + step`，内容是累计文本；完成时 partial 与最终完整消息原子替换；失败、中止、超时和 dispose 清理 partial；迟到 delta 不再发布。UI 仍对结构化自定义 `AgentUIAdapter` 做防御性匹配，不能让不匹配的 partial 污染当前 transcript。

## 方案

### 消息内容状态

所有 message 条目新增必填字段：

```ts
export type AgentUIContentStatus = 'complete' | 'streaming' | 'incomplete'

type MessageItem = {
  // existing fields
  readonly contentStatus: AgentUIContentStatus
}
```

普通用户消息、Human-in-the-Loop 问答、上下文快照和完整 AssistantMessage 使用 `complete`。当前 Core partial 使用 `streaming`。已经展示过但运行以 error、aborted 或 dispose 结束的 partial 使用 `incomplete`。该字段描述“这段文本是否为已验证的完整消息”，与整个运行的 `runStatus` 正交：例如一个已完成的 Tool Call 前置 Assistant 文本可以是 `contentStatus: 'complete'`，但随后运行失败后它的 `runStatus` 会变为 `error`。

采用所有 message 必填字段，而不是可选 `isStreaming`：可选字段会让自定义 UI 在失败后仍需结合 role、runStatus 和消息位置猜测；布尔值也无法区分成功完成与失败保留。`contentStatus` 不加入 tool 条目，因为工具已有独立 `pending | completed | error`。

### Store 投影

Store 内部只跟踪一个当前流式条目引用 `{ runId, step, itemId }`，不保存 Provider delta。处理合法 partial 时：

1. 仅接受活动状态、`partial.runId === state.runId`、非空内容和非负整数 step；不匹配快照忽略。
2. 同一 `runId + step` 更新现有 item 的累计 `content`，保留 ID 和位置。
3. 新步骤到来前若旧草稿尚未由完整消息结算，保留旧文本并标记 `incomplete`，再创建新条目。

活动 Tool Call 步骤完成时，Core 会发布包含完整 AssistantMessage、且不含 partial 的 running 状态。由于 Core 状态限频可能取消尚未发布的尾随 partial，UI 最后观察到的草稿可以只是最终文本的前缀。`#projectObservedMessage()` 若遇到当前流式条目，且最终文本以当前可见草稿开头，则原位补齐最终内容并改为 `complete`，随后照常投影 Tool Call；若前缀不一致则保留旧条目为 `incomplete` 并追加完整消息，避免自定义 Adapter 用不一致状态静默改写用户已经看到的文本。

最终完成状态继续以 `result.content` 为压缩安全的终态来源：匹配当前流式条目时原位提升，否则沿用现有追加行为。这样不依赖终态 `messages` 的历史长度，避免历史压缩改变 `baseLength`。error/aborted/disposed 将当前流式条目标记为 `incomplete`，再沿用 runStatus 更新；`idle + empty messages` 清空 items 和流式引用。

Store 初次绑定到非空或活动上下文时继续使用 `historyCompleteness: 'context_only'`。若同步回放状态含合法 partial，则在上下文快照之后创建活动 streaming item，并为该运行建立从当前消息长度开始的观察边界，使之后的完整消息可以结算该 item。终止后或 runId/step 不匹配的 partial 不创建条目。

### Web Component 与 Demo

Web Component 继续按稳定 ID 复用同一 `article`。message 元素增加 `data-content-status`、`content-streaming`/`content-incomplete` class，以及新增稳定 CSS part `message-streaming`/`message-incomplete`。streaming 使用不改变布局的克制尾部光标反馈，并在 `prefers-reduced-motion` 下关闭动画；incomplete 使用现有危险色的轻边框提示，不向消息正文拼接状态文案。全局运行/错误区仍提供自然语言状态。

每次更新前继续计算 near-bottom；只有接近底部时把内容增长后的列表滚到底部。离开底部的用户位置不改变。消息仍通过 `textContent` 渲染，不解释 HTML 或 Markdown。

Demo fake Agent 在最终 AssistantMessage 前按确定性计时发布多个累计 `partialResponse`，完成、停止和 Human-in-the-Loop 流程仍可离线复现。Demo 不实现独立 tokenizer 或 Provider stream。

不采用在 `AgentUIState` 顶层复制 `partialResponse`：这会迫使每个 React/Vue UI 再把它合并进列表，违背 Store 的 presenter 职责。不采用删除失败 partial：会造成可见内容闪退。不采用把 partial 写入 Core `messages`：会破坏已批准的模型历史原子性。

## 影响范围

| 包或区域 | 文件 | 变更 |
| --- | --- | --- |
| UI 公开类型 | `packages/ui/src/types.ts` | message `contentStatus` 判别状态 |
| UI Store | `packages/ui/src/AgentUIStore.ts` | partial 创建、原位更新、完成提升和终止保留 |
| UI Store 测试 | `packages/ui/src/AgentUIStore.test.ts` | 稳定 ID、多步、终态、初始绑定和迟到隔离 |
| Web Component | `packages/ui/src/web-component.ts` | keyed 状态属性、parts、视觉反馈与滚动 |
| Web Component 测试 | `packages/ui/src/web-component.test.ts` | DOM 身份、纯文本、状态样式和滚动保护 |
| Demo | `examples/ui-demo/demo-agent.mjs`、相关测试 | 确定性累计 partial 演示 |
| 文档 | `README.md`、三份 `docs/design/` 基线 | Store 用法、字段迁移、消息与状态边界 |

## Runtime 契约

- Core 与 Provider 公共契约不变；UI 只消费现有 `AgentState.partialResponse`。
- UI streaming item 是展示投影，不进入 Core messages、历史压缩、结果或后续模型请求。
- `(runId, step)` 是当前草稿关联键，UI item ID 在同一步的所有累计更新和成功提升中保持稳定。
- `contentStatus` 与 `runStatus` 独立：前者描述文本完整性，后者描述所属运行终态。
- 只有以当前可见草稿为前缀的完整 Assistant 文本可把 streaming 提升为 complete；这兼容被 Core 限频合并的尾随增量，不一致状态不得覆盖已显示文本。
- 失败、中止、超时和 dispose 保留 partial 为 incomplete；clearHistory 是唯一清空整个 transcript 的 Core 边界。
- 每个工具步骤仍只投影最终完整 Tool Call，partial 不公开工具参数或 Provider chunk。
- Store 快照继续深冻结、排除 Core `messages` 和工具载荷；旧 Agent/Store 或迟到 partial 不得修改当前投影。
- Web Component 保持纯文本、SSR 安全、单输入框和外部 Store 所有权契约。

## 兼容性与迁移

`AgentUIContentStatus` 是新增导出，所有 `AgentUIItem` message 分支增加必填 `contentStatus`。只读取现有字段的 JavaScript 使用方无需修改；TypeScript 中自行构造或穷尽断言 message item 的使用方需要补字段。Store 工厂和 Web Component 属性不变。

没有启用 Core streaming 的 Agent 仍只产生 `complete` 消息，视觉和交互行为保持原样。自定义 `AgentUIAdapter` 无需实现新方法，只需在其 AgentState 中按 Core 契约提供可选 partial。根入口继续无 DOM，浏览器子路径的模块加载和 SSR 边界不变。

回滚可移除 UI 的 partial 消费和 contentStatus 字段，不涉及模型历史或持久数据迁移。Demo 计时仅用于本地固定场景。

## TDD 与验证方案

1. Red：Store 测试表达 partial 创建、累计内容、稳定 ID 和必填 contentStatus，预期因当前 Store 忽略 partial 失败。
2. Green：增加当前流式条目引用与最小累计投影，补齐所有现有 message item 的 complete 状态。
3. Red/Green：覆盖最终回答原位提升、带文本 Tool Call、多步骤独立条目和无 partial 兼容路径。
4. Red/Green：覆盖 error/abort/dispose incomplete 保留、clear 清空、runId/step 不匹配及终止后迟到状态。
5. Red/Green：覆盖 Store 在进行中流式状态创建时的 context_only 初始化与后续结算。
6. Red/Green：Web Component 覆盖稳定 DOM 身份、状态 class/part、纯文本、near-bottom 自动滚动和离底保护。
7. Red/Green：Demo fake Agent 发布累计 partial，更新离线流程测试。
8. Refactor：复用消息查找/更新方法，确保快照不保留 delta 序列或 Core messages，不改变 Human-in-the-Loop 与工具安全投影。
9. 更新 README 与设计基线，运行 UI/Demo 聚焦测试、SSR、`npm run check`、覆盖率、打包预检，并在桌面和 390px 视口进行真实浏览器检查。
