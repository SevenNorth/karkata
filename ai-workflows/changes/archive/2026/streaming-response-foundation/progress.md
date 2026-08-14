# 实施进度：增加流式回答基础

## 当前状态

- 当前任务：完成验收与归档
- TDD 阶段：Refactor 与全量验证完成
- 最后完成：Core + OpenAI-compatible 流式基础、设计基线和全部交付门禁
- 阻塞项：无

## 已修改文件

- `packages/core/src/types.ts`
- `packages/core/src/Agent.ts`
- `packages/core/src/Agent.test.ts`
- `packages/core/type-tests/streaming.ts`
- `packages/openai-compatible/src/OpenAICompatibleAdapter.ts`
- `packages/openai-compatible/src/OpenAICompatibleAdapter.test.ts`
- `packages/openai-compatible/package.json`
- `package-lock.json`
- `README.md`
- `docs/design/Karkata无头智能体运行时设计.md`
- `docs/design/Karkata消息与会话协议.md`
- `ai-workflows/changes/active/streaming-response-foundation/*`

## 关键决策

- 流式显式开启，默认 `invoke()` 路径不变。
- 使用可选 `LLMAdapter.stream()` iterator yield `text_delta`，并以 iterator 完成返回值交付 `LLMResponse`。
- `AgentState.partialResponse` 与 `messages` 隔离，不污染模型历史。
- `streaming` 使用可扩展配置对象，内置状态限频和输出长度上限。
- `finish_reason` 不立即终止 SSE；继续接收 usage，优先以 `[DONE]` 结束。
- iterator 清理不 await，不影响取消及时收敛。
- 本 change 只涉及 Core 和 OpenAI-compatible，UI 消费作为后续独立 change。
- OpenAI-compatible 使用 `eventsource-parser` 处理跨 chunk SSE，并在消费响应体后禁用自动重试。
- 最终边界审查补充了 Provider 工厂开启 streaming、无效 iterator、流式请求转换与 Header 失败测试。

## 验证记录

- Core 初始 Red：6 failed、100 passed；Green/Refactor 后 109 passed。
- Provider 初始 Red：8 failed、22 passed；Green/Refactor 后 33 passed。
- `npm run check` 通过：6 个测试文件、175 项测试，类型检查和 workspace 构建通过。
- `npm run test:coverage` 通过：statements 90.35%、branches 85.26%、functions 90.95%、lines 94.39%。
- `npm pack --workspaces --dry-run` 通过，四个 workspace 包内容正常。

## 下一步

- 校验 change，流转为 completed 并归档；UI 增量投影另立后续 change。
