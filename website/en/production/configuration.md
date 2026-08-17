---
title: Production Configuration
description: Public configuration reference for the Core Agent and OpenAI-compatible Provider
---

# Production Configuration

The names below describe the public `0.1.0` API. Provider-specific fields not listed here belong in `transformRequest` or the host gateway; do not put provider secrets into Agent state.

## Provider

`createAgent()` from `@karkata-ai/openai-compatible` accepts:

| Field | Purpose |
| --- | --- |
| `model` | Required model id |
| `baseURL` | Required OpenAI-compatible HTTP root; use a server-side allowlist in production |
| `apiKey` | Optional API key; long-lived values belong on the server |
| `headers` | Static headers or a per-request header resolver |
| `fetch` | Injectable Fetch implementation for proxies, tests, or runtime customization |
| `maxRetries` | Retries per model call; defaults to `2` |
| `transformRequest` | Provider compatibility fields; never log an unsanitized request |

## Agent

The `agent` object is passed to Core:

| Field | Default | Purpose |
| --- | --- | --- |
| `maxSteps` | `20` | Limits model decision steps in one run |
| `timeoutMs` | `120000` | Limits one `send()` run |
| `maxToolResultLength` | `20000` | Limits one tool result entering context |
| `maxInstructionsLength` | `20000` | Limits dynamic instruction text |
| `streaming.stateUpdateIntervalMs` | `32` | Throttles partial-response state updates |
| `streaming.maxOutputLength` | `200000` | Limits output characters in one streaming step |
| `contextBudget` | Disabled | Host-provided token estimation and optional history compaction |
| `humanInput` | Disabled | Enables requests waiting for user input |

Choose values from model limits, cost, and tool side effects. Timeout and retries do not replace an idempotency design for upstream actions.

## Environment variables

Environment variable names are not a fixed Karkata Core API. A deployment may use `LLM_BASE_URL`, `LLM_API_KEY`, and `LLM_MODEL`, validate them at startup, and pass them to the Provider after HTTPS and allowlist checks.
