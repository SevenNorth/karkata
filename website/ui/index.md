---
title: UI 集成
description: 使用 Store 或 Web Component 构建 Karkata 界面
---

# UI 集成

`@karkata-ai/ui` 提供 DOM-free Store 和显式浏览器入口。React、Vue 与原生视图都可以订阅同一快照，不需要把 Core 状态改写为框架专属对象。

## 自定义界面

```ts
import { createAgentUIStore } from '@karkata-ai/ui'

const store = createAgentUIStore(agent)
const unsubscribe = store.subscribe(() => {
  const state = store.getSnapshot()
  render(state.items, state.composer)
})

await store.submit('查询订单 1042')
```

`items` 是 Store 绑定期间观察到的 UI transcript，不是模型历史或 checkpoint。所有消息都带有 `contentStatus`：

- `complete`：正文已经验证完成。
- `streaming`：当前模型步骤的累计临时文本。
- `incomplete`：失败或停止后保留的已显示文本。

同一个输入框通过 `composer.mode` 在普通消息和 Human-in-the-Loop 回答之间切换。应用只调用 `store.submit(text)`，不需要从消息文本猜测当前语义。

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

主入口在导入阶段不访问 DOM；只有 `/web-component` 子路径需要浏览器环境。需要跨组件挂载保留 transcript 时，由应用创建 Store 并赋给 `panel.store`。

本页顶部站点导航可返回首页，直接体验正常流程、停止和错误恢复。

## 实际界面

以下截图由 production preview 的确定性离线 Demo 生成；交互 Demo 仍是主要验收入口。

![Karkata 桌面端 Demo 展示订单工具、用户确认和完成消息](/images/demo-desktop.png)

![Karkata 移动端 Demo 正在等待用户回答配送地址问题](/images/demo-mobile.png)
