---
title: Deployment Checklist
description: Environment, streaming, and security checks before deploying a Karkata application
---

# Deployment Checklist

This is a host-application launch checklist, not an automatic Karkata deployer. The repository does not provide a production gateway or Docker image; the deployment owner must implement and audit its HTTP service.

## Before startup

- Use a Node.js `>=20` runtime, lock dependencies, and run build and type checks.
- Inject the Provider URL, key, and model through server-side secret storage; reject empty, non-HTTPS, or non-allowlisted URLs at startup.
- Enable user authentication, tenant isolation, tool authorization, body limits, concurrency limits, and rate limits.
- Disable debug logging; never log environment variables, headers, prompts, or full responses.

## Reverse proxy and streaming

- Allow only required methods and same-origin or explicitly allowed Origins for `/api`.
- Forward `text/event-stream`, flush promptly, and disable buffering or caching that breaks SSE.
- Abort the upstream Fetch when the client disconnects; set connection, first-byte, and total-duration timeouts.
- Keep health checks local to application/configuration status; do not call a real model or reveal upstream URLs or credentials.

## Observability

Record request id, allowlisted model id, status, duration, retry count, usage summary, and error code. Track and alert separately for upstream failures, rate limits, tool failures, and cancellation; do not record raw content.

## After launch

- Use a no-business-data test account to verify non-streaming and SSE streaming requests.
- Verify cancellation, timeout, retry, Provider 401/429/5xx, rejected tools, and context-limit behavior.
- Confirm browser network panels contain no long-lived key; check response headers, CORS/CSRF, and caching.
- Set quota, cost, and abnormal-traffic alerts and prepare key rotation and version rollback.

See [Production Architecture](/en/production/architecture), [Production Security](/en/production/security), and [Configuration](/en/production/configuration).
