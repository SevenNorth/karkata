# Karkata UI 交互契约

## 1. 目的与边界

`@karkata/ui` 是 `@karkata/core` 之上的可选展示层，包含无 DOM 的 `AgentUIStore` 和 `@karkata/ui/web-component` 浏览器入口。它不改变模型上下文、Agent 生命周期或工具协议，也不提供 Provider、凭据、持久化、Markdown 渲染和工具授权策略。

Core 的 `AgentState.messages` 是模型上下文快照，会受历史压缩和运行回滚影响。Store 的 `AgentUIState.items` 是绑定期间观察到的 UI transcript。这两个集合生命周期不同，不能互换或互相回写。

## 2. Store 契约

```ts
import { createAgentUIStore } from '@karkata/ui'

const store = createAgentUIStore(agent)
const unsubscribe = store.subscribe(() => {
  render(store.getSnapshot())
})

await store.submit('查询订单 123')

unsubscribe()
store.dispose()
```

传入的 Agent 可以是真实 Core `Agent`，也可以是实现 `send()`、`subscribe()`、`subscribeRequests()`、`respond()` 和 `abort()` 的结构化适配器。自定义适配器必须沿用 Core 的同步回放规则：`subscribe()` 在订阅时同步发送当前状态，存在未决请求时 `subscribeRequests()` 同步发送该请求。

`getSnapshot()` 在没有变化时返回同一引用；有效变化增加单调 `revision`。快照及其子值冻结，订阅者异常彼此隔离。`dispose()` 幂等解除 Store 自身的两个 Agent 订阅并清空 Store 监听器，但不调用 Agent 的 `abort()` 或 `dispose()`。

## 3. 展示记录

`AgentUIState.items` 是以下判别联合：

- `type: 'message'`：用户、Assistant 或 Human-in-the-Loop 问答文本。
- `type: 'tool'`：只包含 `name`、`callId`、运行状态及 `pending | completed | error`，不包含工具 input/result。

普通消息使用 `source: 'conversation'`。Human-in-the-Loop 问题和被 Store 确认接受的回答作为普通 Assistant/用户消息出现，同时使用 `source: 'human_input'`、`requestId` 和 `callId` 保留协议关联。问题还包含 `pending | answered | cancelled` 状态。

Store 从空上下文开始观察时，`historyCompleteness` 为 `session`。这只表示本 Store 看到了当前会话从空上下文开始的变化，不表示内容已持久化。若创建 Store 时 Agent 已有消息或正在运行，已有内容标记为 `source: 'context_snapshot'`、`runStatus: 'unknown'` 和 `historyCompleteness: 'context_only'`；Store 无法恢复压缩前、绑定前或刷新前已丢失的对话边界。

绑定后观察到的条目不会仅因模型历史被压缩，或当前运行失败、中止而被删除；它们会保留并更新 `runStatus`。外部 `agent.clearHistory()` 产生的空闲空历史会清空展示记录。Agent `dispose()` 只冻结并禁用 Store，不伪装成一次历史清空。

`AgentUIItem` 是运行时展示 API，不是可反序列化的 checkpoint 格式。需要跨刷新或跨进程恢复时，必须使用后续版本化的持久化契约。

## 4. 单输入框路由

`AgentUIState.composer` 明确当前输入含义：

```ts
type AgentUIComposer =
  | { mode: 'message' }
  | { mode: 'response'; requestId: string; callId: string; prompt: string }
```

应用只调用 `store.submit(input)`：

- `message` 模式调用 `agent.send(input)`，返回 `{ type: 'message', result }`。
- `response` 模式调用 `agent.respond(requestId, input)`，返回 `{ type: 'response', accepted }`。
- 空输入、运行中发送新消息或 disposed 状态会拒绝。
- 回答因竞争、取消或超时失效时返回 `accepted: false`，绝不降级为新的用户消息；自定义 UI 应保留输入，让用户决定如何处理。

等待 Human-in-the-Loop 回答时，发起本轮的 `send()` Promise 仍未完成。因此 UI 不能用覆盖整个 `send()` Promise 的全局 `submitPending` 禁用 response composer。应以最新的 `status` 和 `composer.mode` 决定控件状态，Core 负责最终并发线性化。

## 5. React 与 Vue

React 可直接使用外部 Store 协议：

```tsx
const store = useMemo(() => createAgentUIStore(agent), [agent])
useEffect(() => () => store.dispose(), [store])

const state = useSyncExternalStore(
  (listener) => store.subscribe(listener),
  () => store.getSnapshot(),
  () => store.getSnapshot(),
)

async function submit(text: string) {
  const result = await store.submit(text)
  if (result.type === 'response' && !result.accepted) {
    // Keep the draft visible; the request lost a race or expired.
  }
}
```

Vue 可将快照放入 `shallowRef`：

```ts
const store = createAgentUIStore(agent)
const state = shallowRef(store.getSnapshot())
const unsubscribe = store.subscribe(() => {
  state.value = store.getSnapshot()
})

onUnmounted(() => {
  unsubscribe()
  store.dispose()
})
```

若多个视图共享一个 Store，应由更高层的会话所有者统一销毁，单个视图卸载时只调用自己的 unsubscribe。

## 6. Web Component

浏览器子路径在模块导入阶段不读取 DOM。应用显式注册元素：

```ts
import {
  defineKarkataPanel,
  type KarkataPanelElement,
} from '@karkata/ui/web-component'

defineKarkataPanel()
const panel = document.querySelector<KarkataPanelElement>('karkata-panel')!
panel.agent = agent
```

`defineKarkataPanel(tagName?)` 默认注册 `karkata-panel`，对本模块已注册的同名元素幂等；若名称已被其他构造器占用则抛错。调用注册函数或实例化组件要求 Custom Elements 和 Shadow DOM 支持。

`panel.agent` 是便利模式：面板连接时创建内部 Store，断开时销毁它，因此重连无法保留断开前的 Store transcript。需要跨挂载或多个视图共享时使用外部所有权：

```ts
const store = createAgentUIStore(agent)
panel.store = store

// 会话真正结束时
store.dispose()
```

后赋值的 `agent` 或 `store` 替换前一种绑定。外部 Store 在面板断开或替换时只解除 UI 订阅，不由组件销毁。

组件使用一个 textarea：`message` 与 `response` composer 只改变输入语义和标签。Enter 提交，Shift+Enter 换行，输入法 composition 期间 Enter 不提交。失效回答保留输入；活动运行可以调用停止按钮转发 `abort()`。所有内容以纯文本渲染，不解释 HTML 或 Markdown。

面板默认面向终端用户：运行状态、问题状态和工具状态先映射为自然文案，不直接展示 `waiting_for_input` 等协议枚举。工具条目和活动工具名默认隐藏；诊断界面可设置 `panel.showTools = true` 开启，该属性只改变 DOM 投影，不改变 Store 快照。没有可见条目时显示可配置空状态。

只有当当前状态为 `error`、`error.retryable === true`，且展示记录中存在同一 `runId` 的失败普通用户消息时，面板才显示重试。重试通过 `store.submit(originalMessage)` 开始新运行，不重放 Human-in-the-Loop 回答、工具载荷或上下文快照，也不清空输入框中的当前草稿。重试不意味着旧运行的外部副作用已回滚或具有幂等性。

## 7. 可访问性与主题

状态和消息区域使用 live region，消息列表使用 log 语义，错误使用 alert，图标按钮具有可替换的可访问名称。`labels` 是 `Partial<KarkataPanelLabels>`，可按需覆盖按钮、输入占位、上下文快照、空状态、运行/问题/工具状态以及本地错误文案；未覆盖字段使用内置英文默认值。

组件公开以下 CSS 自定义属性：

- `--karkata-background`
- `--karkata-surface`
- `--karkata-border`
- `--karkata-text`
- `--karkata-muted`
- `--karkata-accent`
- `--karkata-danger`

稳定 parts 包括 `panel`、`header`、`status`、`context`、`messages`、`empty`、`message`、`message-user`、`message-assistant`、`tool`、`error`、`retry`、`composer`、`submit` 和 `abort`。长文本必须换行；新增条目只在用户已接近列表底部时自动滚动。

## 8. 安全不变量

- Store 快照不包含完整 `AgentState.messages`、`activeTool.input`、工具输入或工具结果。
- Web Component 不使用 `innerHTML` 解释模型、用户、错误或工具文本。
- Human-in-the-Loop 是交互协议，不是授权边界；敏感工具仍由宿主执行权限检查。
- 多个 Store 可以竞争同一请求，只有 `respond()` 返回 `true` 的一方记录用户回答；其他视图必须收敛到最新状态。
- 旧 Agent、旧 Store、已终止运行或失效请求的迟到结果不得修改当前 composer、输入草稿或展示记录。
