# @karkata/core

English | [中文](https://github.com/SevenNorth/karkata/blob/main/packages/core/README.md)

The framework-neutral Karkata Agent Runtime. It provides the model loop, normalized messages, tool registration, persistent sessions, cancellation and timeout handling, streaming state, and Human-in-the-Loop protocols without depending on a DOM or a specific model provider.

## Installation

```bash
npm install @karkata/core zod
```

## Usage

```ts
import { Agent, defineTool, type LLMAdapter } from '@karkata/core'
import { z } from 'zod'

const llm: LLMAdapter = {
  async invoke(_request, { signal }) {
    signal.throwIfAborted()
    return { message: { role: 'assistant', content: 'Done' } }
  },
}

const ping = defineTool({
  name: 'ping',
  description: 'Return a visible confirmation',
  inputSchema: z.object({ value: z.string() }),
  execute: ({ value }) => ({ value }),
})

const agent = new Agent({ llm, tools: [ping], timeoutMs: 30_000 })
const result = await agent.send('Start')
```

`LLMAdapter` owns the provider protocol. Install `@karkata/openai-compatible` when using an OpenAI-compatible service. Tool results must be serializable, model-visible `ToolOutput` values. One Agent instance runs only one `send()` at a time; successful runs commit the session, while failed, aborted, and timed-out runs roll back.

Read state through `subscribe()`. Receive Human-in-the-Loop questions through `subscribeRequests()` and answer them with `respond()`. When `streaming` is enabled, `state.partialResponse` is a temporary UI projection and is never added to model history.

See the [Karkata repository](https://github.com/SevenNorth/karkata) for the complete design and API examples.

## License

[MIT](https://github.com/SevenNorth/karkata/blob/main/LICENSE)
