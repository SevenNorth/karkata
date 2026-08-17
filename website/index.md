---
layout: page
title: Karkata
description: 面向 TypeScript 应用的轻量 Headless Agent Runtime
---

<div class="k-home-intro">
  <p class="k-eyebrow">TypeScript Headless Agent Runtime</p>
  <h1>Karkata</h1>
  <p class="k-lead">管理模型调用、工具循环、持续会话、取消、流式回答与 Human-in-the-Loop，不绑定 UI 框架或模型厂商。</p>
  <div class="k-install" aria-label="安装命令"><span aria-hidden="true">$</span><code>npm install @karkata-ai/core @karkata-ai/openai-compatible</code></div>
  <div class="k-actions">
    <a class="k-action-primary" href="./guide/quick-start">开始使用</a>
    <a class="k-action-secondary" href="./ui/">UI 集成</a>
  </div>
</div>

<div class="k-demo-heading">
  <div>
    <p class="k-section-label">交互演示</p>
    <h2>完整运行，而不是静态预览</h2>
  </div>
  <p>选择订单流程或错误恢复。所有状态均在浏览器本地确定性运行。</p>
</div>

<ClientOnly>
  <KarkataDemo locale="zh" />
</ClientOnly>

<div class="k-next-band">
  <a href="./guide/quick-start"><strong>快速开始</strong><span>创建 Agent 并发送第一条消息</span></a>
  <a href="./ui/"><strong>自定义界面</strong><span>使用 Store、React、Vue 或 Web Component</span></a>
  <a href="./guide/security"><strong>安全边界</strong><span>凭据、工具、取消与浏览器部署</span></a>
</div>
