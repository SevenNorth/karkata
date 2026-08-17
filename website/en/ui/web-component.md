---
title: Web Component
description: Register and configure karkata-panel
---

# Web Component

The browser entry requires Custom Elements and Shadow DOM and must be registered explicitly:

```ts
import { createAgentUIStore } from '@karkata-ai/ui'
import { defineKarkataPanel, type KarkataPanelElement } from '@karkata-ai/ui/web-component'

defineKarkataPanel()
const panel = document.createElement('karkata-panel') as KarkataPanelElement
panel.store = createAgentUIStore(agent)
panel.labels = { send: 'Send', abort: 'Stop' }
panel.showTools = true
document.body.append(panel)
```

The main `@karkata-ai/ui` entry does not access the DOM during import; only `/web-component` is browser-specific. With `panel.agent`, the component owns and disposes its internal Store when unbound. An external `panel.store` remains application-owned and can preserve the UI transcript across mounts.

Labels support partial overrides, and `--karkata-*` CSS custom properties control the theme. Registering the same tag again is idempotent, but the helper will not replace an unrelated custom element implementation.
