# Karkata AI 协作约定

本文件是 AI 编码代理的仓库级入口。修改代码或项目文档前，先读取目标包的源码、测试和 `ai-workflows` 中对应流程。

`docs/design/` 保存已采纳的架构与 Runtime 契约，是实现和评审的仓库内设计基线。外部讨论归档仅作历史背景，不得成为开发、构建、测试或工作流依赖。

## 项目边界

Karkata 是通用 Headless Agent Runtime：

- `@karkata-ai/core` 只负责规范化消息、会话、Agent 生命周期、状态、取消和工具注册，不依赖 DOM、UI 框架、模型厂商或 Node 专属模块。
- `@karkata-ai/openai-compatible` 只负责 OpenAI 兼容协议的请求与响应归一化。
- `@karkata-ai/javascript` 是在宿主当前 Realm 执行代码的显式注册可选工具，只公开 `createUnsafeJavaScriptTool()`；它不是安全沙箱，不得由 Core 自动启用，也不得用于不可信代码。
- DOM、HTTP、数据库和业务动作由使用方注册工具提供，不加入 Core 内置能力。

## 流程选择

满足以下全部条件时使用轻量流程：

- 只影响一个包，通常不超过 2 至 3 个文件。
- 不新增或修改导出 API、消息协议、工具协议、状态机和错误契约。
- 不修改取消、超时、会话提交、工具版本一致性或迟到结果隔离。
- 不修改 workspace、构建、发布或测试基础设施。
- 需求明确、风险有限且容易回滚。

轻量流程：读取相关代码和测试，在对话中简述修改意图，执行 TDD 的 Red-Green-Refactor，运行相关检查并汇报结果。无需创建 change 文档。详见 `ai-workflows/workflows/lightweight-change.md`。

以下任务必须使用完整流程：

- 新功能、新包、新 Provider、新可选工具或新持久化/UI 能力。
- 新增或修改公共 API、规范化消息、Tool Call、状态、错误或配置契约。
- 修改 Agent 主循环、会话提交、工具热插拔、取消、超时或异步竞态处理。
- 跨两个及以上包，或修改 workspace、构建、发布、测试基础设施。
- 存在多种方案、兼容性风险、验收边界不清晰或预计修改 5 个及以上文件。

完整流程定义在 `ai-workflows/README.md`，状态按 `draft -> approved -> implementing -> completed -> archived` 流转。AI 不得代替用户批准自己的方案；未获明确批准前，不修改生产代码。

## TDD 硬约束

基础 Runtime 的所有行为变更都必须使用测试驱动开发：

1. 先写聚焦测试，描述公开行为或明确的窄边界。
2. 运行测试并确认它因目标行为缺失而失败（Red）。
3. 实现使测试通过的最小完整变更（Green）。
4. 在测试持续通过的前提下重构（Refactor）。
5. 运行受影响包测试，再运行 `npm run check`。

缺陷修复必须先有能复现问题的回归测试。不得为了变绿而删除、跳过、放宽或整体改写既有测试。若公共契约有意改变，先在 change 的 proposal/design 中说明并获得批准，再更新测试。

纯文档、机械格式化和工作流基础设施本身可不伪造 Red 阶段，但仍需执行相称验证。

## Runtime 不变量

- 一个 Agent 实例同一时间最多运行一次 `send()`。
- 同一实例默认保留成功提交的会话，直到 `clearHistory()`。
- 失败、中断和超时运行不提交不完整消息序列。
- 每个 Tool Call 有唯一 `callId`，工具结果必须关联原调用。
- 工具 Schema 校验与执行使用同一快照注册。
- 工具替换生成新 `registrationId`；旧调用返回 `TOOL_CHANGED`，不得执行任一版本。
- 旧解注册回调不能删除后续同名注册。
- LLM、工具和用户回调接收当前运行的 `AbortSignal`。
- 即使异步依赖忽略信号，取消也必须使 `send()` 及时收敛。
- 旧运行或已终止运行的迟到结果不能修改消息、状态、结果或订阅者。
- 对外状态是隔离快照，单个订阅者异常不能影响 Runtime。
- 工具输出进入模型上下文前必须可序列化并受长度限制。

改变以上不变量必须使用完整流程，并增加契约测试，同时更新 `docs/design/` 中受影响的设计文档。

## 大型变更拆分

完整变更在 draft 阶段必须评估规模。满足以下任一条件时，在进入 approved 前提出拆分建议并等待用户确认：

- 预计超过 10 个实施任务。
- 涉及 3 个及以上包或子系统。
- 同时包含 Runtime 基础设施改造和上层能力。
- 存在可独立交付、验证或回滚的阶段。
- 预计无法在一次连续会话内完成。

同一验收目标优先拆 `tasks.md`；可独立验证和回滚的结果可建议拆 Git 提交；具有独立审批或风险边界的部分拆为多个 change。拆分不授权自动提交，只有用户明确要求时才能创建 commit。

## 测试与验证

- 使用 Vitest，测试与源码共置为 `src/**/*.test.ts`。
- 单元测试使用确定性的假 Adapter、假工具和本地响应，不调用真实模型或外部服务。
- 异步控制流覆盖成功、拒绝、取消、超时和相关竞态，并断言禁止的副作用没有发生。
- Provider 测试请求归一化、响应归一化、重试分类和取消传递；Core 测试公开 Runtime 契约。
- Fake Timer 只用于时间语义测试，测试结束必须恢复。
- 覆盖率是辅助证据，不替代行为断言。

交付前的必需门禁：

```bash
npm run check
```

修改共享控制流或准备发布时额外运行：

```bash
npm run test:coverage
npm pack --workspaces --dry-run
```

## TypeScript、错误与安全

- 保持严格 TypeScript；不以 `any` 绕过边界，所有模型和工具输入必须运行时校验。
- 使用判别联合表达消息、状态和结果；只从包 `index.ts` 导出稳定契约。
- Core 保持浏览器和 Node.js 兼容，不导入 `node:*`。
- 区分编程错误、可恢复工具错误、手动中断、超时和 Runtime 故障。
- 只重试明确可重试错误，不重试鉴权、校验和普通 4xx。
- API Key、Authorization Header 和未脱敏请求不得进入状态、消息或错误文本。
- 不声称 `AbortSignal` 一定停止外部副作用；它首先保证 Runtime 及时收敛。

## 仓库卫生

- 先读目标模块和相邻测试，再实现；只修改批准范围内文件，不夹带重构。
- 公共 API 或 Runtime 契约变化同步更新 README、导出、change 文档和 `docs/design/` 中受影响的设计基线。
- 不提交 `node_modules`、`dist`、`coverage`、`*.tsbuildinfo`、密钥或调试残留。
- lockfile 只通过 npm 命令修改。
- 不覆盖用户已有改动，不主动创建 commit。
- 提交使用 Conventional Commits，冒号后的主题和正文使用中文。

## 中断恢复

完整变更中断后运行：

```bash
npm run ai:change:resume -- <change-id>
```

重新读取 proposal、design、tasks、progress，并核对 `git status` 与 `git diff`。批准范围未变化时无需重新批准；契约或范围实质变化时运行 `npm run ai:change:revise -- <change-id>`，更新文档并重新确认。
