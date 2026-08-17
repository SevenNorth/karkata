---
title: API Map
description: Stable Karkata package entries and key exports
---

# API Map

This page lists stable entries only. Use the linked guides and package types for behavior and boundaries.

| Package | Stable exports | Guide |
| --- | --- | --- |
| `@karkata/core` | `Agent`, `defineTool`, `ToolRegistry`, message/state/error types | [Core](/en/guide/core), [Tools](/en/guide/tools) |
| `@karkata/openai-compatible` | `OpenAICompatibleAdapter`, `createAgent` | [Provider](/en/provider/openai-compatible) |
| `@karkata/ui` | `AgentUIStore`, `createAgentUIStore`, UI discriminated unions | [UI Integration](/en/ui/) |
| `@karkata/ui/web-component` | `defineKarkataPanel`, panel types | [Web Component](/en/ui/web-component) |
| `@karkata/javascript` | `createUnsafeJavaScriptTool` | [Security Boundaries](/en/guide/security) |

Core remains DOM-free and imports no `node:*` modules. Web Component is an explicit browser subpath. The JavaScript tool is an explicitly unsafe optional package and is never enabled by Core.
