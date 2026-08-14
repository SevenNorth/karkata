# @karkata/ui

[English](https://github.com/SevenNorth/karkata/blob/main/packages/ui/README.en.md) | 中文

Karkata 的框架无关 UI Store 与可选 Web Component。Store 把 Agent 状态、Human-in-the-Loop 请求和流式回答投影为稳定的 UI transcript；React、Vue 和原生视图都可以自行订阅。

## 安装

```bash
npm install @karkata/core @karkata/ui
```

## 自定义 UI

```ts
import { createAgentUIStore } from '@karkata/ui'

const store = createAgentUIStore(agent)
const unsubscribe = store.subscribe(() => {
  const snapshot = store.getSnapshot()
  render(snapshot.items, snapshot.composerMode)
})

void store.submit('发送消息或回答当前问题')

unsubscribe()
store.dispose()
```

每条消息都具有 `contentStatus: 'complete' | 'streaming' | 'incomplete'`。失败或停止运行时，已经显示的部分回答会保留为 `incomplete`。`items` 是当前 Store 生命周期内的 UI transcript，不是 checkpoint 格式。

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

`@karkata/ui` 主入口在导入阶段不访问 DOM；只有显式的 `/web-component` 子路径需要浏览器 DOM。长期 transcript 连续性应由应用持有 Store，并通过 `panel.store` 传入。

完整交互契约见 [Karkata 仓库](https://github.com/SevenNorth/karkata)。

## License

[MIT](https://github.com/SevenNorth/karkata/blob/main/LICENSE)
