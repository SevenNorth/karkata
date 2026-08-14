---
title: Security Boundaries
description: Credential, tool, and cancellation boundaries in Karkata
---

# Security Boundaries

Karkata owns messages, tool loops, state, and cancellation inside the Runtime. Applications still own identity, authorization, business data, and external side effects.

## Model credentials

Do not put long-lived API keys in public browser bundles, GitHub Pages, or frontend environment variables. Use an application backend proxy, short-lived token, or authenticated custom `fetch` implementation.

## Tool authorization

A Human-in-the-Loop question can collect information, but it is not an authorization boundary. Tools that pay, delete, approve, or access sensitive data must validate the current user and permissions at execution time.

Tool output enters model context. Return a minimal safe DTO instead of raw database records, credentials, Authorization headers, or unredacted error bodies.

## Cancellation and side effects

`AbortSignal` makes the Runtime stop waiting promptly and isolates late results. If an external system ignores cancellation, an already started request or business side effect may continue. Account for idempotency before retrying a tool.

## JavaScript tool

`@karkata/javascript` executes code in the host's current Realm. It is not a security sandbox and must only run fully trusted scripts, never user input, third-party content, or untrusted model-generated code.

This site's offline demo uses a deterministic fake Agent. It reads no API key and calls no model or third-party service.
