---
title: Error Handling
description: Error classification, retries, and safe presentation in production
---

# Error Handling

On failure, `AgentResult` contains a structured error. The UI may show `message`, but server logs should use `code`, `retryable`, a request id, and sanitized metadata; never echo the raw Provider body.

## Categories

| Category | Representative codes | Retry by default | Guidance |
| --- | --- | --- | --- |
| Provider network/rate limit | `MODEL_NETWORK_ERROR`, `MODEL_RATE_LIMIT` | Network errors and 429 may retry | Use backoff, concurrency limits, and a user retry action |
| Provider auth/request | `MODEL_AUTH_ERROR`, `MODEL_PROVIDER_ERROR` | No | Check server credentials, model allowlists, and upstream status |
| Provider response | `MODEL_INVALID_RESPONSE` | No | Keep safe metadata and verify protocol compatibility |
| Tool input/execution | `TOOL_INVALID_INPUT`, `TOOL_EXECUTION_ERROR` | No | Validate input, re-authorize, and check idempotency |
| Tool version | `TOOL_CHANGED`, `TOOL_NOT_FOUND` | No | Use the latest tool snapshot and let the model decide again |
| Runtime boundary | `MAX_STEPS_EXCEEDED`, `TIMEOUT`, `ABORTED` | No | End the run; do not commit incomplete messages |
| Context | `TOOL_RESULT_TOO_LARGE`, `CONTEXT_LIMIT_EXCEEDED`, `CONTEXT_ESTIMATION_ERROR`, `CONTEXT_COMPACTION_ERROR` | No | Shorten input, limit tool output, or adjust the budget |

`MODEL_ERROR`, `INSTRUCTION_RESOLUTION_ERROR`, `INSTRUCTIONS_TOO_LARGE`, and `INTERNAL_ERROR` also end the run. Do not automatically replay a complete Agent run unless the error is explicitly marked `retryable`.

## Cancellation and late results

After cancellation or timeout, Runtime converges promptly and isolates late model/tool results. It cannot undo a side effect already sent to an external system; payment, write, and delete tools need idempotency keys and server-side compensation.

## Gateway mapping

A gateway may map upstream HTTP statuses to consistent `4xx`, `429`, or `5xx` responses, but must not send keys, full requests, response bodies, or internal stacks to the browser. Generate a correlation id and keep public errors separate from internal logs.
