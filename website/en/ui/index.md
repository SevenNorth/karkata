---
title: UI Integration
description: Build Karkata interfaces with the Store or Web Component
---

# UI Integration

`@karkata-ai/ui` provides a DOM-free Store and an explicit browser entry. React, Vue, and native views subscribe to the same snapshot without rewriting Core state into framework-specific objects.

## Custom UI

```ts
import { createAgentUIStore } from '@karkata-ai/ui'

const store = createAgentUIStore(agent)
const unsubscribe = store.subscribe(() => {
  const state = store.getSnapshot()
  render(state.items, state.composer)
})

await store.submit('Find order 1042')
```

`items` is the UI transcript observed while the Store is bound. It is not model history or a checkpoint. Every message has a `contentStatus`:

- `complete`: validated final content.
- `streaming`: cumulative temporary text for the current model step.
- `incomplete`: visible text retained after a failure or stop.

The same composer switches between ordinary messages and Human-in-the-Loop answers through `composer.mode`. Applications call only `store.submit(text)` and never infer the current meaning from message text.

## Web Component

```ts
import {
  defineKarkataPanel,
  type KarkataPanelElement,
} from '@karkata-ai/ui/web-component'

defineKarkataPanel()
const panel = document.querySelector<KarkataPanelElement>('karkata-panel')
if (panel) panel.agent = agent
```

The main entry does not access the DOM during import. Only the `/web-component` subpath requires a browser. To preserve a transcript across component mounts, let the application create the Store and assign it through `panel.store`.

Use the site navigation to return home and try the normal flow, stop behavior, and error recovery directly.
