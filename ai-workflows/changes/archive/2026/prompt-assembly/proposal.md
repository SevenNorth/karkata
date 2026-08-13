# 变更提案：增加默认提示词与动态指导组装

## 背景

Karkata 当前仅在配置 `systemPrompt` 时把它写入会话历史，没有 Runtime 默认提示词，也没有按页面、模块或其他宿主上下文动态获取指导的入口。这使工具调用基础规则依赖每个使用方重复编写，也无法在长任务中按环境变化更新指导。

用户已确认：Runtime 始终提供全局兜底默认提示词；`systemPrompt` 是静态增强而非替代；只有指导可以动态解析；Resolver 可同步或异步、可定义在任意模块，并只需返回一段字符串。

## 目标

- 始终向模型提供短小、通用、无 DOM 假设的 Karkata 默认提示词。
- 将 `systemPrompt` 定义为默认提示词后的静态应用增强。
- 支持每次 LLM 调用前同步或异步执行 `resolveInstructions()`。
- 动态指导与当前工具快照一致，支持取消、超时和迟到结果隔离。
- 默认提示词和指导只进入当次模型请求，不进入会话历史或状态消息。
- 对 Resolver 错误、无效返回值和指导超长提供稳定错误分类。

## 范围

- 新增默认提示词与内部 Prompt Assembler。
- 新增 `InstructionResolverContext`、`InstructionResolver` 和相关配置。
- 修改 Agent 每步 LLM 请求组装与错误分类。
- 修改 `clearHistory()` 和状态/历史语义。
- 增加提示词优先级、每步动态解析、快照一致性、取消、错误和长度测试。
- 更新 README 与 Runtime、消息会话、取消协议设计文档。

## 非目标

- 不提供默认提示词覆盖或禁用开关。
- 不提供 scope 对应指导 Map；宿主可通过 Resolver 的工具信息自行判断。
- 不引入页面、URL、路由、DOM 或模块等 Core 概念。
- 不注入网页正文等不可信环境内容。
- 不实现 token 估算、历史摘要、缓存或多级 Resolver。

## 验收标准

- [x] 未配置任何提示词时，每次 LLM 请求仍包含 Karkata 默认 system 消息。
- [x] 静态 `systemPrompt` 追加在默认规则之后，不能替代默认规则。
- [x] Resolver 同步和异步返回值均可用，并在每个模型步骤重新执行。
- [x] Resolver 获得冻结的 `runId`、`step`、当前工具信息与 `AbortSignal`。
- [x] Resolver 与同一步 LLM 请求使用同一工具快照。
- [x] 动态指导、默认提示词和静态增强不进入历史或 `AgentState.messages`。
- [x] Resolver 忽略取消时，`send()` 仍及时收敛。
- [x] Resolver 错误/无效值返回 `INSTRUCTION_RESOLUTION_ERROR`，超长返回 `INSTRUCTIONS_TOO_LARGE`，且不调用模型。
- [x] `clearHistory()` 只清空会话消息，不管理 system 消息。

## 风险

- 所有模型请求将新增一条 system 消息，可能影响已有模型输出，这是有意的 Runtime 契约增强。
- `systemPrompt` 从持久历史迁移为临时请求内容，状态订阅者不再看到 system 消息。
- Resolver 内容位于 system 指令层，必须由宿主保证可信，不能直接提升不可信页面文本。

## 待确认项

- 无。用户已明确要求按已讨论建议进行下一步。
