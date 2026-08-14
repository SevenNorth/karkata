# 技术设计：增加框架无关 Web Component UI

## 现状分析

`@karkata/core` 的 `AgentState.messages` 是 `readonly AgentMessage[]`。`Agent.#commit()` 通过 `structuredClone()` 发布隔离状态快照；运行期间包含已提交历史与当前 `runMessages`，终态只保留成功提交历史。历史压缩成功后会用 `effectiveHistory + runMessages` 替换模型上下文，失败或中止则丢弃本次 `runMessages`。因此该字段是模型上下文快照，而不是稳定或追加式的用户可见 transcript。

临时 system prompt、供应商原始载荷、鉴权数据和内部 Schema 不进入状态，但工具输入和结果仍可能包含敏感业务数据。Human-in-the-Loop 问题编码为 `ask_user` Tool Call，有效回答编码为 JSON Tool Result；它们需要被转成自然对话条目，不能把原始消息直接回显。

`subscribe()` 在订阅时同步回放当前状态，`subscribeRequests()` 在存在未决 Human-in-the-Loop 请求时同步回放请求。`respond()` 使用请求 ID 接受一次非空回答，`abort()` 终止当前运行。这些公开方法覆盖 UI 控制需求，但两条订阅的组合、单输入框路由和展示记录保留需要一个共享 presenter，避免每个 React/Vue/原生使用方重复实现。

workspace 当前有 Core、OpenAI-compatible 和 JavaScript 三个包，均使用 ESM、TypeScript project references、共置 Vitest 测试和 `dist` 发布目录。根配置尚未为 `@karkata/ui` 提供测试别名或 DOM 测试环境。

## 方案

先为 Core 的 Human-in-the-Loop 请求补充原调用关联：

```ts
export interface HumanInputRequest {
  readonly type: 'human_input'
  readonly id: string
  readonly callId: string
  readonly runId: string
  readonly step: number
  readonly prompt: string
}
```

`id` 继续标识一次只能回答一次的宿主请求，`callId` 标识模型发出的原 `ask_user` Tool Call。两者用途不同，不合并；`respond()` 仍只接受请求 `id`。这是增量只读字段，不改变等待、回答、取消或迟到隔离。

新增 `@karkata/ui` 包，运行时依赖 `@karkata/core`。根入口不读取 DOM，公开结构化最小 Agent 接口和 UI Store：

```ts
export interface AgentUIAdapter {
  send(message: string): Promise<AgentResult>
  subscribe(listener: AgentStateListener): () => void
  subscribeRequests(listener: AgentRequestListener): () => void
  respond(requestId: string, answer: string): boolean
  abort(): void
}

export type AgentUIComposer =
  | { readonly mode: 'message' }
  | {
      readonly mode: 'response'
      readonly requestId: string
      readonly callId: string
      readonly prompt: string
    }

export type AgentUISubmitResult =
  | { readonly type: 'message'; readonly result: AgentResult }
  | { readonly type: 'response'; readonly accepted: boolean }

export type AgentUIRunStatus = 'unknown' | 'active' | 'completed' | 'error' | 'aborted'

export type AgentUIItem =
  | {
      readonly type: 'message'
      readonly id: string
      readonly runId?: string
      readonly runStatus: AgentUIRunStatus
      readonly role: 'user' | 'assistant'
      readonly source: 'conversation' | 'context_snapshot'
      readonly content: string
    }
  | {
      readonly type: 'message'
      readonly id: string
      readonly runId: string
      readonly runStatus: AgentUIRunStatus
      readonly role: 'assistant'
      readonly source: 'human_input'
      readonly interaction: 'question'
      readonly requestId: string
      readonly callId: string
      readonly requestStatus: 'pending' | 'answered' | 'cancelled'
      readonly content: string
    }
  | {
      readonly type: 'message'
      readonly id: string
      readonly runId: string
      readonly runStatus: AgentUIRunStatus
      readonly role: 'user'
      readonly source: 'human_input'
      readonly interaction: 'answer'
      readonly requestId: string
      readonly callId: string
      readonly content: string
    }
  | {
      readonly type: 'tool'
      readonly id: string
      readonly runId?: string
      readonly runStatus: AgentUIRunStatus
      readonly callId: string
      readonly name: string
      readonly status: 'pending' | 'completed' | 'error'
    }

export interface AgentUIState {
  readonly items: readonly AgentUIItem[]
  readonly composer: AgentUIComposer
  readonly historyCompleteness: 'session' | 'context_only'
  readonly status: AgentStatus
  readonly runId?: string
  readonly activeToolName?: string
  readonly result?: AgentResult
  readonly error?: AgentError
  readonly contextUsage?: Readonly<ContextUsage>
  readonly revision: number
}

export interface AgentUIStore {
  getSnapshot(): Readonly<AgentUIState>
  subscribe(listener: () => void): () => void
  submit(input: string): Promise<AgentUISubmitResult>
  abort(): void
  dispose(): void
}

export function createAgentUIStore(agent: AgentUIAdapter): AgentUIStore
```

`AgentUIAdapter` 采用结构化最小接口，使真实 `Agent` 可直接传入，也允许宿主包装或代理。自定义实现必须遵守 Core 时序：`subscribe()` 同步回放当前状态，`subscribeRequests()` 在存在请求时同步回放当前请求；监听器异常彼此隔离。Store 组合两条订阅并发布引用稳定的隔离快照，适配 React `useSyncExternalStore`、Vue ref 和原生订阅。每次有效变化增加单调 `revision`；无变化时 `getSnapshot()` 返回同一引用。`dispose()` 幂等释放两个 Agent 订阅及 Store 监听器，但不调用 `agent.abort()` 或 `agent.dispose()`。

Store 创建时若初始 `AgentState.messages` 为空，`historyCompleteness` 为 `session`，之后为每个已观察运行和消息分配稳定 UI ID。被模型上下文压缩替换或因运行失败/中止回滚的已观察条目继续留在展示记录，并结合最终 Agent 状态显示失败或中止结果。若初始消息非空或首次状态已是活动运行，Store 无法可靠还原逐条 runId、提交边界和摘要来源；这些条目统一使用 `source: 'context_snapshot'`、`runStatus: 'unknown'` 和 `historyCompleteness: 'context_only'`，默认面板以区别于普通对话的样式展示。外部 `clearHistory()` 发布 `idle + empty messages` 时清空 Store 展示记录并重新开始 `session`；`disposed + empty` 只终止交互，不伪装成清空会话。

`AgentUIItem` 是公开判别联合：普通 user/assistant 文本形成 `source: 'conversation'` 的消息；初始未知内容形成 `context_snapshot`；`ask_user` 请求通过 `callId` 精确转换为 `source: 'human_input'` 的 Assistant 问题，Store 接受的回答转换为用户消息。问题保留 pending/answered/cancelled 状态，但默认消息列表以普通气泡呈现，不暴露底层工具协议。其他 Tool Call 与 Tool Result 按 `callId` 合并成不含载荷的 `tool` 条目。每个绑定后观察到的条目带 `runId` 与 `runStatus`；运行结束时同一运行的条目统一标记为 completed/error/aborted，使失败或中止内容可以保留且不会伪装成成功提交。

只有 `store.submit()` 调用 `respond()` 并得到 `true` 时，Store 才能保证追加准确的用户回答消息。若其他界面直接回答，Store 可在观察到对应 Tool Result 后标记问题 answered；只有安全解析出固定 `{ answer: string }` 且未截断时才补用户回答，否则仅保留“已回答”状态，不回显原始 JSON。取消、超时或中止时，未决问题标记 cancelled，不创建用户回答。首版不公开或保留其他工具 input/result。`AgentUIState` 也不嵌入完整 `AgentState`，只复制安全的状态、结果、错误、预算及活动工具名称，排除 `messages` 和 `activeTool.input` 旁路。

`submit(input)` 在调用瞬间读取 composer 与 Agent 状态快照。trim 后为空同步拒绝；`message` 模式仅在 idle/completed/error/aborted 时调用 `agent.send()`，`response` 模式仅在 waiting_for_input 时调用 `agent.respond(requestId, input)`，running/disposed 状态拒绝提交。Store 不设置覆盖整个 `send()` Promise 的全局 pending 标志，因为同一次 `send()` 在 Human-in-the-Loop 等待期间仍未结束；等待状态必须允许 response 提交。Core 的同步状态提交和并发门禁是重复消息提交的最终线性化点。

若回答因外部响应、超时或取消返回 `false`，结果明确为 `{ type: 'response', accepted: false }`，保留调用方输入且绝不降级调用 `send()`。状态离开 `waiting_for_input` 时清理旧 composer；下一请求只能由带新 request ID/callId 的快照激活。多个 Store 竞争时，只有得到 `true` 的 Store 添加回答消息，其余 Store 依赖后续状态收敛。

浏览器子路径 `@karkata/ui/web-component` 公开：

```ts
export interface KarkataPanelLabels {
  readonly send: string
  readonly abort: string
  readonly messagePlaceholder: string
  readonly responsePlaceholder: string
  readonly contextSnapshot: string
}

export interface KarkataPanelElement extends HTMLElement {
  agent: AgentUIAdapter | null
  store: AgentUIStore | null
  labels: Partial<KarkataPanelLabels> | null
}

export function defineKarkataPanel(tagName?: string): CustomElementConstructor
```

子路径导入本身不访问 DOM 或注册元素；组件构造器在 `defineKarkataPanel()` 内基于当前 Realm 的 `HTMLElement` 延迟创建。无 Custom Elements/Shadow DOM 时注册函数抛出明确环境错误。默认注册 `karkata-panel`，同名同构造器时幂等，同名其他构造器时抛出冲突错误。直接设置 `agent` 是便利模式，面板创建并拥有内部 Store；设置外部 `store` 时 Store 生命周期由宿主管理，适合 React/Vue 重挂载或多个视图共享。两者互斥，后赋值者替换前者。面板断开时只解除对外部 Store 的 UI 订阅；内部 Store 则释放 Agent 订阅，避免元素被丢弃后泄漏。需要跨挂载连续记录时必须使用外部 Store。

组件构造时创建 open Shadow Root 和稳定 DOM 骨架。面板包括状态栏、增量 keyed 消息区、错误区和一个输入区；composer 的 `message|response` 模式只改变输入语义和可访问名称，不创建第二个输入框。运行时禁用重复提交并显示中止控件；`disposed` 或未绑定 Store 时禁用交互。回答被拒绝时保留输入供用户确认，不把它发送成新消息。中文等输入法处于 composition 状态时 Enter 不提交。

所有外部字符串通过 DOM 文本节点或 `textContent` 写入；不使用 `innerHTML` 渲染消息。Shadow DOM 样式使用中性默认配色、清晰焦点和响应式约束，公开有限的 `--karkata-*` CSS 自定义属性及 `header`、`messages`、`message`、`tool`、`composer`、`submit`、`abort`、`status` parts。`labels` 允许覆盖发送、中止、输入占位、回答占位、状态和上下文提示等固定文案，默认对象不可变；这不是完整 locale 或格式化系统。状态变化通过 `aria-live`，表单有显式可访问名称。新条目仅在用户已接近底部时自动滚动，长文本必须换行且不能撑破窄屏。

不采用 Core 级 transcript 或 `RenderableMessage`：本阶段先验证 UI 层需求，避免把展示生命周期写入 Runtime；代价是首版 Store 只保证绑定期间记录，跨刷新恢复留给 checkpoint/persistence change。不采用纯内部投影：它会迫使 React/Vue 重写同样的请求组合和消息语义。不采用自动注册：显式函数更适合 ESM、测试和多版本页面。不采用框架组件：Store 加 Web Component 已覆盖框架集成和默认视图。

## 影响范围

| 包或区域 | 文件 | 变更 |
| --- | --- | --- |
| UI Store | `packages/ui/src/index.ts`、Store、类型与投影文件 | 无 DOM 公开 API、订阅组合、会话期 transcript 与统一提交 |
| Web Component | `packages/ui/src/web-component.ts`、组件与样式文件 | 浏览器子路径、默认面板与显式注册 |
| UI 测试 | `packages/ui/src/**/*.test.ts`、测试环境配置 | Store 契约、上下文/展示记录差异、DOM、安全和生命周期测试 |
| Core Human-in-the-Loop | `packages/core/src/types.ts`、`Agent.ts`、相关测试 | 请求增加原 Tool Call `callId`，生命周期不变 |
| workspace | `package-lock.json`、`vitest.config.ts`、TypeScript references（按实际需要） | workspace 依赖、别名和 DOM 测试接入 |
| 文档 | `README.md`、`docs/design/README.md`、Runtime 设计及新增 UI 契约文档 | 安装/使用示例、公共行为和路线图状态 |
| change | `ai-workflows/changes/active/web-component-ui/*` | 审批、TDD 和验证证据 |

## Runtime 契约

- Core 的消息、状态、错误、取消、超时和会话提交契约均不变化；`HumanInputRequest` 只增加原 Tool Call `callId`。
- UI 只通过公开 Agent 方法观察和控制运行，不恢复或修改模型会话，也不把展示记录送回模型。
- Store 快照是隔离且引用稳定的深只读值；无变化时 `getSnapshot()` 返回同一引用，便于框架外部 Store 协议消费。
- Store 快照不暴露原始 `AgentState.messages` 或 `activeTool.input`；使用方需要模型上下文时应直接订阅 Core，并自行承担数据展示策略。
- `historyCompleteness: 'session'` 仅表示 Store 从空上下文开始观察当前会话，不代表已经持久化；`context_only` 明确表示初始历史可能已压缩或缺失。
- `context_snapshot` 条目始终使用 `runStatus: 'unknown'`，默认 UI 不得把它们冒充普通用户/Assistant 对话。
- 已观察展示条目不会仅因 Core 成功压缩、失败或中止回滚而被删除；`clearHistory()` 是显式清空边界。
- `submit()` 以调用瞬间 composer 和 Agent 状态为路由依据；未决的原 `send()` Promise 不阻止 response，失效回答不会变成新消息，重复提交不会绕过 Core 并发保护。
- 当前 Human-in-the-Loop 请求由 request ID 标识回答权，由 `callId` 关联模型消息；状态终止或离开等待后旧请求失效，迟到请求/状态不得恢复旧 composer。
- Tool Call/Result 的 UI 合并只依赖 `callId`，不改变 Core 消息顺序、内容、错误或配对语义；工具载荷不进入首版 UI 快照。
- Store 和组件的 `dispose`/断开均不拥有 Agent 运行生命周期，不隐式中止或销毁 Agent。
- `idle + empty messages` 是 `clearHistory()` 的 UI 清空信号；`disposed + empty messages` 只冻结并禁用 UI，不清空 Store transcript。
- 组件不解释外部内容为 HTML；内容展示不能扩大模型、用户或工具数据的权限。
- `AgentUIItem` 不承诺可序列化、版本稳定或适合作为 checkpoint；持久化能力必须另行定义版本与恢复校验。

## 兼容性与迁移

`HumanInputRequest.callId` 是增量必填只读字段；只读取既有字段的使用方无需迁移，对请求对象做穷尽形状断言的测试需更新。现有消息和会话历史格式不变。

`@karkata/ui` 是独立可选包。根入口和 `./web-component` 模块加载阶段均不访问 `window`、`document`、`HTMLElement` 或 `customElements`，可供 SSR 和 Node 测试导入；只有调用 `defineKarkataPanel()` 或实例化返回的构造器要求支持 Custom Elements 与 Shadow DOM 的浏览器 Realm。

包版本与 workspace 当前 `0.1.0` 对齐，使用 `@karkata/core` 的 workspace 版本依赖并发布根入口与 `./web-component` 两个 export。显式注册允许应用决定 tag name，并避免导入副作用。Store API 是新增公共表面，但不改变现有包；回滚可整体移除 UI 包和文档入口，不影响 Core 会话或持久数据。

## TDD 与验证方案

1. Red：为 `HumanInputRequest.callId` 增加请求快照、Tool Call 关联、多个顺序请求和迟到隔离测试。Green：补充 Core 类型和请求创建参数，不改变生命周期。
2. Red：增加无 DOM 根入口、Store 创建/释放、稳定快照、revision 和监听器隔离测试。Green：创建 UI 包骨架、公开类型和最小订阅组合。
3. Red：增加空会话 session transcript、非空/活动初始 `context_only`、`context_snapshot + unknown`、历史压缩替换、运行失败/中止回滚及 clear/dispose 区分测试。Green：实现稳定 ID、增量展示记录及完整性标记。
4. Red：增加普通消息顺序、运行结果标记、Tool Call/Result 配对、pending/error/孤立结果和工具载荷缺失测试。Green：实现公开安全投影。
5. Red：增加 Human-in-the-Loop 普通问答消息、callId 关联、同步回放、Store/外部回答、取消/超时、连续请求及无法恢复外部回答正文测试。Green：实现问答投影和状态收敛。
6. Red：增加原 send 未决时回答、失效回答不降级发送、running/disposed 拒绝和多 Store 竞争测试。Green：实现无全局 pending 阻塞的 composer 与 `submit()`。
7. Red：增加 SSR 安全导入、默认/自定义 tag、幂等/冲突注册、Agent/Store 所有权和断开重连测试。Green：实现延迟 DOM 构造的 Web Component 入口。
8. Red：增加纯文本注入、单输入框、IME、滚动保护、长内容、labels、CSS parts 和可访问状态测试。Green：实现稳定 DOM、交互和响应式样式。
9. Refactor：核对快照不泄漏载荷、Store 引用稳定、旧来源隔离、默认上下文视觉语义和组件增量 keyed 渲染。
10. 更新文档并运行 Core/UI 聚焦测试、Node/SSR 导入、包级 typecheck/build、`npm run check`、覆盖率、打包预检及桌面/窄屏真实浏览器检查。
