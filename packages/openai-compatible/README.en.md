# @karkata-ai/openai-compatible

[Documentation](https://sevennorth.github.io/karkata/en/provider/openai-compatible) | English | [中文](https://github.com/SevenNorth/karkata/blob/main/packages/openai-compatible/README.md)

Karkata's OpenAI-compatible Chat Completions adapter. It includes the concise `createAgent()` factory and the standalone `OpenAICompatibleAdapter` for direct use with Core.

## Installation

```bash
npm install @karkata-ai/core @karkata-ai/openai-compatible
```

## Usage

```ts
import { createAgent } from '@karkata-ai/openai-compatible'

const agent = createAgent({
  model: 'your-model',
  baseURL: 'https://your-provider.example/v1',
  apiKey: process.env.MODEL_API_KEY,
  maxRetries: 2,
  agent: {
    systemPrompt: 'Reply in English.',
    streaming: {},
  },
})

const result = await agent.send('Hello')
```

`baseURL` is the only required provider option. `model` is optional: when provided, it is sent as request metadata; when omitted, the request does not include a `model` field. With an application LLM proxy, the server may ignore, override, map, or reject a client-provided model. When connecting directly to a provider that requires a model, provide it from the calling application.

The adapter normalizes text, tool calls, token usage, SSE streams, and common HTTP/network failures. It retries only network failures, HTTP 429, and HTTP 5xx. Authentication, validation, and ordinary 4xx errors are not retried. Custom `headers` or `fetch` implementations can provide short-lived tokens or route calls through an application backend.

Do not ship long-lived API keys in public browser bundles. Services with similar OpenAI paths can still differ in streaming events, tool calls, and error bodies; run the explicit real-provider smoke against each target provider before release.

In the Karkata repository, set `KARKATA_BASE_URL`, `KARKATA_API_KEY`, and `KARKATA_MODEL`, then run `npm run test:integration:real`. Optional `KARKATA_STREAMING=true` verifies the streaming path. The command never prints the key or response body.

See the [Karkata repository](https://github.com/SevenNorth/karkata) for complete configuration and Runtime documentation.

## License

[MIT](https://github.com/SevenNorth/karkata/blob/main/LICENSE)
