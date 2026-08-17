---
title: 生产安全
description: 保护模型凭据、用户数据、工具和模型网关
---

# 生产安全

Karkata 不替宿主应用完成身份认证、授权或业务安全。把这些边界放在模型调用和工具执行之前。

## 凭据

- 长期 Provider Key 只放在服务器密钥管理或环境变量中。
- 不把 Key 放入浏览器 bundle、GitHub Pages、URL、状态、消息、日志或错误。
- 网关忽略浏览器提交的 `Authorization`，只使用服务器配置的凭据。
- 使用短期、最小权限凭据，并提供轮换和撤销路径。

## 受限网关

网关只允许固定的上游 origin 和模型白名单。不要接受用户提供的 `baseURL`，也不要实现任意 URL 转发，否则会形成 SSRF 和额度盗用入口。限制请求体、消息长度、工具数量、输出 token、并发数和每用户/IP 频率。

## 用户与工具

先完成应用身份认证，再执行 Agent。每个敏感工具都要在服务端重新检查租户、角色、资源归属和幂等键；不要因为模型提出了 Tool Call 或用户回答了确认问题就跳过授权。

## 数据与日志

默认只记录 request id、耗时、状态、错误分类和用量摘要。不要记录完整提示词、响应、Authorization、Cookie 或内部工具结果。工具返回模型上下文前应映射为最小安全 DTO，并限制输出长度。

## 浏览器边界

使用同源网关时配置精确的 Origin/CORS、CSRF 防护、安全响应头和 HTTPS。SSE 连接断开后取消上游请求；取消只能保证 Runtime 收敛，不能撤销已经发生的外部副作用。

## 检查

上线前阅读[生产架构](/production/architecture)、[错误处理](/production/errors)和[部署检查](/production/deployment)。
