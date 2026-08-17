---
title: API 导航
description: Karkata 稳定包入口与关键导出
---

# API 导航

本页只列稳定入口。具体行为和边界以对应指南及包内类型为准。

| 包 | 稳定导出 | 指南 |
| --- | --- | --- |
| `@karkata-ai/core` | `Agent`、`defineTool`、`ToolRegistry`、消息/状态/错误类型 | [Core](/guide/core)、[工具](/guide/tools) |
| `@karkata-ai/openai-compatible` | `OpenAICompatibleAdapter`、`createAgent` | [Provider](/provider/openai-compatible) |
| `@karkata-ai/ui` | `AgentUIStore`、`createAgentUIStore`、UI 判别联合 | [UI 集成](/ui/) |
| `@karkata-ai/ui/web-component` | `defineKarkataPanel`、Panel 类型 | [Web Component](/ui/web-component) |
| `@karkata-ai/javascript` | `createUnsafeJavaScriptTool` | [安全边界](/guide/security) |

Core 保持 DOM-free 且不导入 `node:*`。Web Component 是显式浏览器子路径；JavaScript 工具是显式不安全可选包，不由 Core 自动启用。
