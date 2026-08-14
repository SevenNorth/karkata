# 变更提案：增加框架无关 Web Component UI

## 背景

Karkata 已经通过 `AgentState`、`subscribe()`、`subscribeRequests()`、`respond()`、`send()` 和 `abort()` 提供完整的 Headless 交互契约，但使用方仍需重复组合状态与请求订阅，实现消息列表、工具调用状态、单输入框分流、取消按钮和 Human-in-the-Loop 回答界面。路线图阶段三因此规划了一个可选、框架无关的 UI 包。

`AgentState.messages` 是 Core 当前用于模型调用的规范化上下文快照，不是稳定的用户可见聊天记录：历史压缩可用摘要替换旧消息，失败和中止会回滚当前运行消息，Human-in-the-Loop 问答则编码为 Tool Call/Result。UI 若直接把它当作聊天记录，会丢失或误呈现内容。首版因此在 `@karkata/ui` 中提供公开、无 DOM 的 UI Store，由它组合现有 Core 契约并维护会话期展示记录；Core 状态协议保持不变。

## 目标

- 提供可选的 `@karkata/ui` 包，以及可注册的 `<karkata-panel>` Web Component 浏览器入口。
- 提供公开、框架无关且可在无 DOM 环境导入的 `AgentUIStore`，供 React、Vue、原生页面和默认面板共同使用。
- 让默认面板通过设置 `panel.agent = agent` 快速使用，也允许传入宿主持有的 Store 以跨组件挂载保留会话期展示记录。
- 展示用户/Assistant 消息、工具执行状态、运行状态、错误和上下文预算。
- 使用统一 `submit()` 将单个输入框安全路由到新消息或当前 Human-in-the-Loop 回答；原始 `send()` 尚未结束时仍可回答等待中的请求。
- 保持 Core 的 Headless 边界和现有消息、状态及运行语义，仅为 `HumanInputRequest` 增加原 Tool Call 的 `callId` 关联。

## 范围

- 新增 `packages/ui`：根入口公开最小 Agent 接口、UI Store、展示条目和统一提交结果；`./web-component` 子路径公开面板元素类型及幂等注册函数。
- Core 的 `HumanInputRequest` 增加只读 `callId`，使 UI 无需依靠 Tool Call 顺序猜测当前问题来源。
- Store 组合状态与请求订阅，生成稳定 ID 的展示条目，并在绑定期间保留因上下文压缩或运行回滚而不再存在于 `AgentState.messages` 的已观察交互。
- Store 将 `ask_user` Tool Call/Result 映射为消息列表中的普通 Assistant 问题和用户回答，同时通过 `source: 'human_input'` 保留协议来源，并公开 `message`/`response` 判别明确的 composer 状态。
- 使用 Shadow DOM 封装结构和样式，提供响应式单栏会话面板、可访问的状态提示和表单控件。
- Tool Call 与 Tool Result 按 `callId` 合并展示，未决、成功和失败状态可区分；原始工具输入和结果默认不进入公开展示条目或 DOM。
- 使用纯文本节点展示模型、用户和安全状态文本，默认不解释 HTML 或 Markdown。
- 处理 Agent 绑定、替换、断开和重连时的状态/请求订阅生命周期。
- 为默认面板提供可替换文案、有限 CSS 自定义属性和稳定 `::part`，覆盖基本语言与宿主主题适配。
- 更新 workspace 配置、README、设计基线和包发布清单，并增加 DOM 行为测试与浏览器视觉检查。

## 非目标

- 除 `HumanInputRequest.callId` 外，不修改 `@karkata/core` 的 `AgentState`、`AgentMessage`、Human-in-the-Loop 生命周期或运行状态契约。
- 不向 Core 增加通用渲染投影；`AgentUIState` 是 `@karkata/ui` 的公开契约，不进入模型上下文。
- 不提供 React/Vue/Svelte 专用组件、完整国际化框架、复杂主题系统或多面板布局；仅支持宿主替换固定 UI 文案和基础样式变量/parts。
- 不提供 Markdown/代码高亮、原始工具载荷查看、附件、语音、结构化 Human-in-the-Loop 表单或工具授权策略。
- 不实现 checkpoint、持久化、历史注入、会话列表或 Provider 原生 compaction item。
- 不承诺 Store 创建前、页面刷新后或进程恢复后的完整展示记录；非空初始 Agent 只能从当前模型上下文做带完整性标记的最佳努力恢复。
- 不内置模型 Provider、API Key 配置或网络代理。

## 验收标准

- [x] React、Vue 或原生使用方可从 `@karkata/ui` 创建无 DOM 的 Store，通过 `getSnapshot()`/`subscribe()` 获得稳定 UI 快照，并通过单一 `submit()` 完成新消息或当前回答。
- [x] Store 从空会话开始绑定时，会话期展示记录不会因 Core 历史压缩、运行失败或中止而静默删除；绑定前已有内容标记为 `context_snapshot + unknown`，不能冒充真实的当前 UI transcript。
- [x] `HumanInputRequest` 通过 `callId` 关联原 `ask_user`；问题和有效回答显示为普通 Assistant/用户条目并标记 `source: 'human_input'`。
- [x] 原始 `send()` Promise 因等待用户而保持未决时，Store 仍允许 response composer 提交回答；失效回答返回明确结果且绝不自动降级为新的 `send()`。
- [x] Tool Call/Result 按 `callId` 映射为未决、成功或失败状态；默认快照和 DOM 均不包含原始工具输入或结果。
- [x] 浏览器使用方可从 `@karkata/ui/web-component` 幂等注册 `<karkata-panel>`，绑定 Agent 或外部 Store 后使用同一套状态与提交语义。
- [x] 用户可提交非空文本；提交期间界面阻止重复操作，活动运行可通过中止控件调用 `agent.abort()`。
- [x] `status`、`activeTool`、公开错误及可选 `contextUsage` 有明确、可访问的视觉反馈，窄屏下控件和内容不重叠或溢出。
- [x] 替换 Agent/Store、元素断开或重新连接时不会残留重复 UI 订阅；Store `dispose()` 只释放自身订阅，不中止或销毁 Agent。
- [x] `@karkata/ui` 根入口和 `./web-component` 均可在无 DOM 环境安全导入；只有调用元素注册函数或实例化组件时要求浏览器 DOM。
- [x] 默认面板支持宿主替换固定文案，并通过文档化 CSS variables/`::part` 定制基础主题而不穿透 Shadow DOM。
- [x] 新包能够独立类型检查、测试和构建，workspace 全量 `npm run check`、覆盖率及 `npm pack --workspaces --dry-run` 通过且发布包不含测试/演示残留。

## 风险

- 新包导出 UI Store、展示条目、composer 和提交结果类型，会形成公共 API；字段必须保持最小，并通过类型及行为测试限制兼容面。
- Store 维护的会话期展示记录与 Core 模型上下文具有不同生命周期；初始恢复能力和所有权必须明确，不能暗示已实现持久化。
- 长驻 Store 的展示记录会增长；首版通过增量 keyed 渲染避免每次重建完整 DOM，但宿主仍需在会话结束后 `dispose()`，后续持久化阶段再定义跨会话保留与裁剪。
- 状态和请求来自两条 Core 通道；Store 必须处理同步回放、外部回答、取消、超时、连续请求和旧 Agent 迟到通知，避免组合出不可能的 composer 状态。
- `AgentUIAdapter` 是结构类型，TypeScript 无法表达同步回放时序；文档和契约测试必须明确自定义实现需在订阅时同步发送当前状态/请求。
- 模型与工具文本均不可信；实现必须使用 `textContent` 等文本 API，不允许通过 `innerHTML` 形成脚本或样式注入。
- 工具数据可能包含业务敏感信息；首版默认不把原始 input/result 放入 UI Store 快照或 DOM，仅展示名称和状态。
- Web Component 依赖 DOM；浏览器子路径必须保持模块加载无 DOM 副作用，并在无 DOM 环境调用注册函数时给出明确错误。
- 单输入框提交存在请求刚失效的竞态；回答被拒绝时必须保留输入并返回失败，不能自动转发为新消息。Store 也不能因原 `send()` Promise 未决而阻止合法回答。
- 初始上下文可能包含无法识别的压缩摘要；默认面板必须以 context snapshot 的独立视觉语义呈现，不能画成普通用户气泡。
- 多个 Store 或界面可以绑定同一 Agent 并竞争回答；只有 `respond()` 返回 `true` 的一方可以追加回答消息，其他界面必须收敛到最新 composer。
- `AgentUIItem` 是运行时展示契约，不是 checkpoint 格式；后续持久化不得未经版本化和校验直接反序列化这些对象。
- 规模评估为 10 个实施任务，影响 Core 的一个增量请求字段、新 UI 包及 workspace/文档接入。`callId` 是 UI 正确关联问答的窄前置契约，与同一验收目标不可分；整体仍可在一个 change 中连续验证，无需拆分。

## 待确认项

- 用户已确认将模型上下文与用户可见记录分开，把框架无关 Store 和渲染投影作为公开能力，并将 Human-in-the-Loop 问答作为带来源标记的普通消息展示。其余修订后边界待本提案明确批准。
