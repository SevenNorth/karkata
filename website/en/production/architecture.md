---
title: Production Architecture
description: Choose the boundary between browser Agents, server Agents, and a restricted model gateway
---

# Production Architecture

Karkata Core owns the Agent lifecycle, model steps, tool loop, state, and cancellation. The host application owns identity, authorization, credentials, business data, and network boundaries.

## Three topologies

| Topology | Use it for | Main risk |
| --- | --- | --- |
| Browser to Provider | Internal prototypes and short-lived tokens | Key exposure, quota abuse, and unprotected tools |
| Server-side Agent | Business data, private tools, and centralized audit | Session, auth, streaming, and concurrency work stays server-side |
| Browser Agent + same-origin gateway | Existing browser UI with a protected provider boundary | The gateway must authenticate, rate-limit, restrict models, and reject arbitrary forwarding |

Public applications usually use one of the latter two. The browser may own the UI and Agent while long-lived credentials stay on the server:

```text
Browser Karkata Agent
        │ same-origin POST + SSE
        ▼
Application gateway
  authentication / limits / allowlist
  server-side API key
        │ OpenAI-compatible request
        ▼
LLM provider
```

## Where tools run

Read-only tools without sensitive data can run in the browser. Database, payment, deletion, approval, and internal API tools should run on the server and re-check the current user's authorization for every execution. Human Input collects information; it is not an authorization grant.

## Sessions and state

An `Agent` keeps successful committed session history in memory by default. Multi-instance deployments must choose session ownership and persistence at the application layer; Core does not currently define a checkpoint or cross-instance storage contract. Failed, aborted, and timed-out runs must not be treated as committed sessions.

See [Production Security](/en/production/security), [Configuration](/en/production/configuration), [Error Handling](/en/production/errors), and the [Deployment Checklist](/en/production/deployment).
