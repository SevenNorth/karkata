---
title: 流式回答
description: 投影 partial 文本并处理完成或中断
---

# 流式回答

当 Adapter 实现 `stream()` 时，在 Agent 配置中显式启用流式回答：

```ts
const agent = new Agent({
  llm,
  streaming: { stateUpdateIntervalMs: 32, maxOutputLength: 200_000 },
})

const unsubscribe = agent.subscribe((state) => {
  if (state.partialResponse) renderDraft(state.partialResponse.content)
})
```

`partialResponse` 是当前模型步骤的累计临时文本，不是已提交消息。正常完成时最终 `AgentResult.content` 与流结束消息一致，随后 partial 被清除。工具调用步骤之间也会清除旧 partial。

错误、超时或停止不会把 partial 写入 Core 会话历史。UI Store 可以把用户已看到的文本投影为 `contentStatus: 'incomplete'`，但这只是 UI transcript，不会改变 Runtime 的回滚语义。迟到的流事件不能更新已终止运行。

Provider 必须让最终消息与已经发送的文本增量一致；无效事件、超长输出或不一致的最终响应会归类为模型响应错误。
