---
title: Web Component
description: 注册并配置 karkata-panel
---

# Web Component

浏览器入口需要 Custom Elements 和 Shadow DOM，必须显式注册：

```ts
import { createAgentUIStore } from '@karkata-ai/ui'
import { defineKarkataPanel, type KarkataPanelElement } from '@karkata-ai/ui/web-component'

defineKarkataPanel()
const panel = document.createElement('karkata-panel') as KarkataPanelElement
panel.store = createAgentUIStore(agent)
panel.labels = { send: '发送', abort: '停止' }
panel.showTools = true
document.body.append(panel)
```

主入口 `@karkata-ai/ui` 在导入阶段不访问 DOM；只有 `/web-component` 子路径用于浏览器。设置 `panel.agent` 时组件拥有并在解绑时销毁内部 Store；设置外部 `panel.store` 时生命周期由应用负责，适合跨挂载保留 UI transcript。

标签接受局部覆盖，主题使用 `--karkata-*` CSS 自定义属性。重复注册同一标签是幂等的，但不能覆盖其他实现已经占用的自定义标签。
