# 技术设计：增加 Human-in-the-Loop 用户输入协议

## 现状分析

`packages/core/src/Agent.ts` 在每次模型响应后把 assistant 消息加入 `runMessages`，再按顺序执行 Tool Call 并追加一一对应的 Tool Result。`runMessages` 仅在成功完成时提交到 `history`，失败、中止和超时都会丢弃，因此可复用现有消息原子性。工具执行、动态指导和上下文估算都使用 `awaitWithAbort()` 与 runId 门禁，适合复用到用户等待。

`ToolRegistry` 负责宿主工具的注册、scope 和版本快照。Human-in-the-Loop 是不可热替换的 Runtime 特殊能力，不应伪装成普通业务工具。`AgentState` 当前没有等待用户状态，请求订阅也不能通过普通状态监听器反向传递回答。

page-agent 的 `ask_user` 内置工具证明了模型侧工具抽象足够自然，但单个 `onAskUser` 回调将 UI 展示、等待和回答绑定在调用栈中。Karkata 采用独立请求通道，使 late subscriber、错误请求 ID、重复响应和终止隔离成为稳定公开行为。

## 方案

新增以下公共类型，具体只读修饰以最终声明为准：

```ts
interface HumanInputConfig {}

interface HumanInputRequest {
  readonly type: 'human_input'
  readonly id: string
  readonly runId: string
  readonly step: number
  readonly prompt: string
}

type AgentRequest = HumanInputRequest
type AgentRequestListener = (request: Readonly<AgentRequest>) => void

interface AgentConfig {
  humanInput?: HumanInputConfig
}
```

`Agent` 新增：

```ts
subscribeRequests(listener: AgentRequestListener): () => void
respond(requestId: string, answer: string): boolean
```

配置 `humanInput: {}` 时，每个 LLM 请求在普通 Registry 快照之外追加一个固定 `ask_user` 定义，Schema 为 `{ question: nonEmptyString }`。未配置时不注入。该名称为启用期间的 Runtime 保留名称：构造工具、`registerTool()`、`replaceTool()` 和 `replaceToolScope()` 均拒绝同名普通工具，避免重复 Schema；未启用时保持该名称可由应用正常使用。

主循环识别 `ask_user` Tool Call 后验证输入，创建独立 UUID 请求并冻结快照，先将状态切换为 `waiting_for_input`，再通知请求订阅者。请求监听器彼此隔离；`subscribeRequests()` 与 `subscribe()` 一样返回幂等解订阅函数，并在存在当前请求时立即回放，使 UI 在挂载稍晚时仍能恢复展示。

`respond()` 是同步线性化点。回答不是字符串或 trim 后为空时抛出 `TypeError`；不存在当前请求、ID 不匹配、运行已终止或该请求已回答时返回 `false`。有效回答原子地占用并清除 pending resolver、返回 `true`。主循环恢复后执行 runId/signal 门禁，将 `{ answer }` 通过现有 Tool Output 序列化及长度限制生成成功 Tool Result，再发布 `running` 状态并继续模型循环。

等待 Promise 使用 `awaitWithAbort()` 竞争当前运行信号。`abort()`、整体 `timeoutMs` 或 `dispose()` 先终止时，等待及时拒绝；结束路径清除 pending request。迟到 `respond()` 返回 `false`，不能写入 `runMessages` 或重新发布状态。首版不创建独立请求计时器，避免整次运行截止时间与局部截止时间出现双重错误分类。

状态流转为：

```text
running -> waiting_for_input -> running -> completed
                         \-> aborted | error(TIMEOUT) | disposed
```

不采用仅在 `AgentConfig` 中提供 `onAskUser` 回调，因为它无法为晚挂载 UI 提供当前请求，也会把请求生命周期隐含在 Promise 中。不把未决请求只塞入 `AgentState`，因为状态订阅是观察通道，不应同时承担有明确请求 ID 的回答协议。不在首版加入 choice/confirmation 判别联合，避免未确定 UI Schema 成为长期公共契约；确认可先用普通问答表达。

## 影响范围

| 包或区域 | 文件 | 变更 |
| --- | --- | --- |
| Core 类型 | `packages/core/src/types.ts`、`index.ts` 声明 | 配置、请求、监听器与等待状态契约 |
| Core 主循环 | `packages/core/src/Agent.ts` | 特殊工具注入、暂停/恢复、响应线性化与清理 |
| Core 测试 | `packages/core/src/Agent.test.ts` | 公开行为、消息配对、状态和异步竞态 |
| 文档 | `README.md`、`docs/design/Karkata无头智能体运行时设计.md`、`Karkata消息与会话协议.md`、`Karkata任务取消与超时协议.md` | 使用示例与长期 Runtime 基线 |
| change | `ai-workflows/changes/active/human-in-the-loop/*` | 审批、TDD 和验证证据 |

## Runtime 契约

- `humanInput` 仅显式配置时启用；默认工具集合、时序和行为不变。
- `ask_user` 是固定 Runtime 特殊工具，不进入 `ToolRegistry`、`listTools()` 或 scope，不受热插拔影响。
- 每个输入请求 ID 唯一且只响应一次；公开请求不暴露内部 resolver、Tool Call 输入对象或可变引用。
- `waiting_for_input` 仍表示同一个活动运行。此时 `send()`、`clearHistory()` 继续抛出 `AgentBusyError`，`abort()` 和 `dispose()` 仍有效。
- 有效回答对应原 `ask_user` 的 `callId`，并在下一次模型调用中以成功 Tool Result 出现。回答使用现有模型可见输出序列化和 `maxToolResultLength` 限制。
- `ask_user` 输入校验失败仍按现有 `TOOL_INVALID_INPUT` 生成错误 Tool Result，不发布请求、不暂停运行。
- 等待期间状态消息可展示当前 `committedHistory + runMessages`，其中可能包含尚未配对的 assistant Tool Call；只有成功运行才把完整配对序列提交历史。
- 同一 assistant 消息中的 Tool Call 继续按数组顺序执行；多个 `ask_user` 因此逐个请求和回答。协议不推断某个普通工具是否需要审批。
- 请求订阅者异常被隔离。解订阅只停止后续通知，不取消当前请求或运行。
- 终止清理后不存在可响应请求；迟到回答、旧运行回答和重复回答均无副作用。

## 兼容性与迁移

新配置可选，新方法为增量 API；未启用的现有使用方无需迁移。`AgentStatus` 增加成员会影响对联合类型做穷尽检查的 TypeScript 使用方，属于有意的公共契约扩展，README 与设计基线必须同步。

实现仅依赖 Web 标准 `AbortController`、`AbortSignal`、`crypto.randomUUID()`、`structuredClone()` 和 Promise，不引入 Node 专属模块，保持浏览器与 Node.js 兼容。回滚可移除可选配置、方法和状态成员，不影响既有持久消息格式；本 change 不承诺跨版本恢复未决请求。

## TDD 与验证方案

1. Red：增加未启用兼容、启用后工具注入、请求快照、等待状态、late subscriber 和监听器隔离测试；预期因配置、工具和请求 API 缺失失败。
2. Green：增加公共类型、特殊工具注入、请求订阅和最小等待/回答路径，使首次行为通过。
3. Red：增加非法输入/回答、错误 ID、重复和迟到回答、多个请求顺序、保留名称冲突及消息提交测试；预期因边界未实现失败。
4. Green：补齐响应线性化、Tool Result 生成、名称保护和成功/失败消息语义。
5. Red：增加手动取消、整体超时、dispose、忽略取消等待与旧运行隔离测试；预期因 pending resolver 未纳入运行清理失败。
6. Green：复用 `awaitWithAbort()`、runId 门禁和统一结束清理，使所有终止路径及时收敛。
7. Refactor：提取特殊工具定义、请求通知与 pending 清理，核对状态和请求均为隔离快照，保持普通 Tool Registry 路径清晰。
8. 更新 README 和三份设计基线；运行 Core 聚焦测试、`npm run check`、`npm run test:coverage`、`npm pack --workspaces --dry-run`、声明检查、change 校验与 Git 检查。
