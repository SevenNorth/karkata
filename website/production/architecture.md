---
title: 生产架构
description: 选择浏览器、服务端 Agent 和受限模型网关的部署边界
---

# 生产架构

Karkata Core 负责 Agent 生命周期、模型步骤、工具循环、状态和取消。身份、授权、凭据、业务数据和网络入口属于宿主应用。

## 三种拓扑

| 拓扑 | 适用场景 | 主要风险 |
| --- | --- | --- |
| 浏览器直连 Provider | 内部原型、短期临时令牌 | API Key 暴露、额度滥用、无法保护工具 |
| 服务端 Agent | 业务数据、私有工具、集中审计 | 需要会话、鉴权、流式响应和并发管理 |
| 浏览器 Agent + 同源网关 | 需要现有 UI Store 和浏览器交互 | 网关必须鉴权、限流、限制模型并阻止任意转发 |

公开应用通常选择后两种。浏览器可以运行 UI 和 Agent，但长期凭据应留在服务器：

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

## 工具放在哪里

只读、无敏感数据的展示工具可以在浏览器运行。数据库、付款、删除、审批和内部 API 工具应在服务端执行，并在每次执行时重新检查当前用户权限。Human-in-the-Loop 只表示收集输入，不等于授权。

## 会话与状态

`Agent` 默认在内存中保留成功提交的会话。多实例部署需要由应用决定会话归属和持久化方式；当前 Core 不提供 checkpoint 或跨实例存储契约。失败、中断和超时运行不应被当作已提交会话。

## 相关页面

- [生产安全](/production/security)
- [生产配置](/production/configuration)
- [错误处理](/production/errors)
- [部署检查](/production/deployment)
