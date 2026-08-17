---
title: Streaming
description: Project partial text and handle completion or interruption
---

# Streaming

When the Adapter implements `stream()`, enable streaming explicitly in the Agent configuration:

```ts
const agent = new Agent({
  llm,
  streaming: { stateUpdateIntervalMs: 32, maxOutputLength: 200_000 },
})

const unsubscribe = agent.subscribe((state) => {
  if (state.partialResponse) renderDraft(state.partialResponse.content)
})
```

`partialResponse` is cumulative temporary text for the current model step, not a committed message. On normal completion, the final `AgentResult.content` matches the stream's final message and the partial is cleared. A tool-call step also clears the previous partial.

An error, timeout, or abort does not write partial text into Core session history. The UI Store may project text already shown to the user as `contentStatus: 'incomplete'`, but that UI transcript does not change Runtime rollback semantics. Late events cannot update a terminated run.

The Provider must keep the final message consistent with emitted text deltas. Invalid events, oversized output, or a mismatched final response become model response errors.
