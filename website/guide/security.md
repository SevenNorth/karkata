---
title: 安全边界
description: Karkata 的凭据、工具与取消边界
---

# 安全边界

Karkata 负责 Runtime 内的消息、工具循环、状态和取消。应用仍然负责身份、权限、业务数据和外部副作用。

## 模型凭据

不要把长期 API Key 放入公开浏览器 bundle、GitHub Pages 或前端环境变量。使用应用后端代理、短期令牌或自定义鉴权 `fetch`。

## 工具授权

Human-in-the-Loop 问题可以补充信息，但不是授权边界。涉及付款、删除、审批或敏感数据的工具必须在执行端重新验证当前用户和权限。

工具输出会进入模型上下文，应返回最小安全 DTO。不要直接返回内部数据库记录、凭据、Authorization Header 或未脱敏错误体。

## 取消与副作用

`AbortSignal` 让 Runtime 及时停止等待并隔离迟到结果。若外部系统忽略取消，已发出的请求或业务副作用仍可能继续；重试工具前必须考虑幂等性。

## JavaScript 工具

`@karkata/javascript` 在宿主当前 Realm 执行代码，不是安全沙箱。它只能运行完全可信的脚本，不能处理用户输入、第三方内容或不可信模型代码。

本站离线 Demo 使用确定性假 Agent，不读取 API Key，也不调用模型或第三方服务。
