---
title: Human Input
description: Request user input while preserving authorization boundaries
---

# Human Input

With `humanInput` enabled, the model can call the reserved `ask_user` tool. The Runtime emits a structured request, and the host answers by request ID:

```ts
const agent = new Agent({ llm, humanInput: {} })

const unsubscribe = agent.subscribeRequests((request) => {
  if (request.type === 'human_input') showQuestion(request.prompt, (answer) => {
    agent.respond(request.id, answer)
  })
})
```

The state is `waiting_for_input` while waiting. `respond()` accepts only the active request for the current run; stale or duplicate requests return `false`, and an empty answer throws `TypeError`. Cancellation settles the wait promptly, and a late answer cannot resume an old run.

## Not an authorization system

A user answer is only model context. `ask_user` grants no database, payment, file, or network permission and does not establish identity. High-impact tools must still perform authentication, authorization, parameter confirmation, auditing, and idempotency checks.

Never treat “the user said yes” as a security token or expose sensitive approval data to the model unchanged.
