---
layout: page
title: Karkata
description: A lightweight, headless agent runtime for TypeScript applications
---

<div class="k-home-intro">
  <p class="k-eyebrow">TypeScript Headless Agent Runtime</p>
  <h1>Karkata</h1>
  <p class="k-lead">Manage model calls, tool loops, persistent sessions, cancellation, streaming responses, and Human-in-the-Loop input without binding your application to a UI framework or model provider.</p>
  <div class="k-install" aria-label="Install command"><span aria-hidden="true">$</span><code>npm install @karkata/core @karkata/openai-compatible</code></div>
  <div class="k-actions">
    <a class="k-action-primary" href="./guide/quick-start">Get started</a>
    <a class="k-action-secondary" href="./ui/">UI integration</a>
  </div>
</div>

<div class="k-demo-heading">
  <div>
    <p class="k-section-label">Interactive demo</p>
    <h2>A complete run, not a static preview</h2>
  </div>
  <p>Choose the order flow or error recovery. Every state runs deterministically in your browser.</p>
</div>

<ClientOnly>
  <KarkataDemo locale="en" />
</ClientOnly>

<div class="k-next-band">
  <a href="./guide/quick-start"><strong>Quick start</strong><span>Create an Agent and send the first message</span></a>
  <a href="./ui/"><strong>Custom UI</strong><span>Use the Store, React, Vue, or Web Component</span></a>
  <a href="./guide/security"><strong>Security</strong><span>Credentials, tools, cancellation, and browser deployment</span></a>
</div>
