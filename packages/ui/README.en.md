# @karkata/ui

[Documentation](https://sevennorth.github.io/karkata/en/ui/) | English | [中文](https://github.com/SevenNorth/karkata/blob/main/packages/ui/README.md)

Karkata's framework-neutral UI Store and optional Web Component. The Store projects Agent state, Human-in-the-Loop requests, and streaming responses into a stable UI transcript that React, Vue, and native views can subscribe to directly.

## Installation

```bash
npm install @karkata/core @karkata/ui
```

## Custom UI

```ts
import { createAgentUIStore } from '@karkata/ui'

const store = createAgentUIStore(agent)
const unsubscribe = store.subscribe(() => {
  const snapshot = store.getSnapshot()
  render(snapshot.items, snapshot.composerMode)
})

void store.submit('Send a message or answer the current question')

unsubscribe()
store.dispose()
```

Every message has `contentStatus: 'complete' | 'streaming' | 'incomplete'`. If a run fails or is stopped, already visible partial text remains as `incomplete`. `items` is the UI transcript observed during the current Store lifetime, not a checkpoint format.

## Web Component

```ts
import { defineKarkataPanel, type KarkataPanelElement } from '@karkata/ui/web-component'

defineKarkataPanel()
const panel = document.querySelector<KarkataPanelElement>('karkata-panel')
if (panel) {
  panel.agent = agent
  panel.showTools = false
}
```

The `@karkata/ui` main entry does not access the DOM during import. Only the explicit `/web-component` subpath requires a browser DOM. For transcript continuity, let the application own the Store and assign it through `panel.store`.

See the [Karkata repository](https://github.com/SevenNorth/karkata) for the complete interaction contract.

## License

[MIT](https://github.com/SevenNorth/karkata/blob/main/LICENSE)
