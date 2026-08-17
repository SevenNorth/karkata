---
title: 人机协同
description: 请求用户输入并明确授权边界
---

# 人机协同

启用 `humanInput` 后，模型可以调用保留的 `ask_user` 工具。Runtime 发出结构化请求，宿主通过请求 ID 回答：

```ts
const agent = new Agent({ llm, humanInput: {} })

const unsubscribe = agent.subscribeRequests((request) => {
  if (request.type === 'human_input') showQuestion(request.prompt, (answer) => {
    agent.respond(request.id, answer)
  })
})
```

等待期间状态为 `waiting_for_input`。`respond()` 只接受当前运行中的活动请求，过期或重复请求返回 `false`；空答案会抛出 `TypeError`。取消会及时结束等待，迟到回答不能恢复旧运行。

## 不是授权系统

用户回答只是一段进入模型上下文的输入。`ask_user` 不授予数据库、支付、文件或网络权限，也不证明操作者身份。高风险动作仍必须在对应工具内部完成身份认证、权限检查、参数确认、审计和幂等控制。

不要把“用户回复了同意”当作安全授权令牌，也不要把敏感审批数据原样暴露给模型。
