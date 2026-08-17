---
title: Production Security
description: Protect model credentials, user data, tools, and the model gateway
---

# Production Security

Karkata does not perform host-application authentication, authorization, or business security. Place those controls before model calls and tool execution.

## Credentials

- Keep long-lived provider keys in server-side secret storage or environment variables.
- Never put keys in browser bundles, GitHub Pages, URLs, state, messages, logs, or errors.
- Ignore browser-supplied `Authorization` at the gateway and use only the server-configured credential.
- Use short-lived, least-privilege credentials with a rotation and revocation path.

## Restricted gateway

Allowlist the upstream origin and model at the gateway. Do not accept a user-supplied `baseURL` or implement arbitrary URL forwarding; that creates SSRF and quota-abuse paths. Limit body size, message length, tool count, output tokens, concurrency, and per-user/IP rate.

## Users and tools

Authenticate the application user before running the Agent. Every sensitive tool must re-check tenant, role, resource ownership, and idempotency on the server. A model Tool Call or a user's confirmation is not an authorization bypass.

## Data and logs

Prefer request id, duration, status, error class, and usage summaries in logs. Do not log full prompts, responses, Authorization, cookies, or internal tool results. Map tool output to a minimal safe DTO before it enters model context and enforce an output limit.

## Browser boundary

For a same-origin gateway, configure exact Origin/CORS rules, CSRF protection, security headers, and HTTPS. Abort upstream work when an SSE client disconnects; cancellation makes Runtime converge but cannot undo an external side effect that already happened.

Before launch, read [Production Architecture](/en/production/architecture), [Error Handling](/en/production/errors), and the [Deployment Checklist](/en/production/deployment).
