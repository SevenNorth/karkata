---
title: 生产配置
description: Core Agent 与 OpenAI-compatible Provider 的公开配置参考
---

# 生产配置

配置名以下列当前 `0.1.0` 公开 API 为准。未列出的 Provider 专属字段应通过 `transformRequest` 或宿主网关处理，不要把供应商密钥写入 Agent 状态。

## Provider

`@karkata-ai/openai-compatible` 的 `createAgent()` 接受：

| 字段 | 作用 |
| --- | --- |
| `model` | 必填模型 ID |
| `baseURL` | 必填 OpenAI-compatible HTTP 根地址；生产环境使用服务端白名单值 |
| `apiKey` | 可选 API Key；长期值只在服务端使用 |
| `headers` | 静态 Header 或每次请求解析的 Header 函数 |
| `fetch` | 可注入的 Fetch 实现，适用于代理、测试或运行时定制 |
| `maxRetries` | 单次模型调用的重试次数，默认 `2` |
| `transformRequest` | 调整供应商兼容字段，不应记录未脱敏请求 |

## Agent

`agent` 配置会传给 Core：

| 字段 | 默认值 | 作用 |
| --- | --- | --- |
| `maxSteps` | `20` | 限制一次运行的模型决策步骤 |
| `timeoutMs` | `120000` | 限制一次 `send()` 运行时间 |
| `maxToolResultLength` | `20000` | 限制进入上下文的单个工具结果 |
| `maxInstructionsLength` | `20000` | 限制动态指导文本 |
| `streaming.stateUpdateIntervalMs` | `32` | 限制部分回答状态更新频率 |
| `streaming.maxOutputLength` | `200000` | 限制单个流式步骤输出字符数 |
| `contextBudget` | 未启用 | 由宿主提供 token 估算和可选历史压缩 |
| `humanInput` | 未启用 | 开启等待用户回答的请求通道 |

生产值应根据模型限制、业务成本和工具副作用设置；超时和重试不能替代上游幂等设计。

## 环境变量

环境变量名不是 Karkata Core 的固定 API。部署应用可以约定 `LLM_BASE_URL`、`LLM_API_KEY` 和 `LLM_MODEL`，读取后传入 Provider，并在启动时校验非空和 HTTPS/allowlist。
