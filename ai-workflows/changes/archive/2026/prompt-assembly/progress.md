# 实施进度：增加默认提示词与动态指导组装

## 当前状态

- 当前任务：已完成并归档
- TDD 阶段：完成
- 最后完成：全仓测试、覆盖率、构建、打包、声明与 change 验证
- 阻塞项：无

## 已修改文件

- `ai-workflows/changes/archive/2026/prompt-assembly/*`
- `packages/core/src/prompt.ts`
- `packages/core/src/types.ts`
- `packages/core/src/Agent.ts`
- `packages/core/src/Agent.test.ts`
- `README.md`
- `docs/design/Karkata无头智能体运行时设计.md`
- `docs/design/Karkata消息与会话协议.md`
- `docs/design/Karkata任务取消与超时协议.md`

## 关键决策

- 默认 Runtime 提示词始终存在；`systemPrompt` 只做静态增强。
- Resolver 每步调用一次，只返回字符串，不返回 scope 结构。
- Resolver 与 LLM 使用同一工具快照，动态指导不进入历史或状态。
- Resolver 错误和超长指导不降级为无指导执行。

## 验证记录

- 初始 Red：6 个新增测试失败，既有 18 个测试通过。
- Green：24/24 聚焦测试通过；clean typecheck 首次发现 exact optional 类型问题，修正后通过。
- 配置校验 Red：非法长度限制测试失败；实现后聚焦测试 25/25、clean typecheck 通过。
- 全仓门禁：`npm run check` 通过，3 个测试文件、29/29 测试通过。
- 覆盖率：全仓行覆盖率 90.37%，Core 93.19%，`prompt.ts` 100%。
- 发布检查：clean、build、workspace pack dry-run 通过，Core 声明导出符合设计边界。
- 一致性检查：change 验证与 `git diff --check` 通过。

## 下一步

- 无。
