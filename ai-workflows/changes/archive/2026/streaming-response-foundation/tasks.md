# 实施任务：增加流式回答基础

## 任务

- [x] 1. Red/Green：增加可选 stream iterator 契约、显式配置对象与默认 invoke 兼容行为。
- [x] 2. Red/Green：增加 `partialResponse` 分片累积、leading + trailing 状态限频和成功原子替换。
- [x] 3. Red/Green：覆盖缺少有效完成返回值、非法 delta、文本不一致、输出超限、Tool Call 多步与 partial 生命周期。
- [x] 4. Red/Green：覆盖中断、超时、iterator 忽略信号、非阻塞 `return()` 和迟到事件隔离。
- [x] 5. Red/Green：OpenAI-compatible 实现 SSE 文本、分片 Tool Call、`finish_reason` 后 usage 与 `[DONE]`/EOF 终止。
- [x] 6. Red/Green：覆盖流式建连/HTTP 重试、消费后失败不重试、取消与安全错误。
- [x] 7. Refactor：共享 Provider 请求和错误归一化，整理 Core iterator 清理与公开导出。
- [x] 8. 更新 README、Runtime 设计和消息/会话协议。
- [x] 9. 运行聚焦测试、全量 check、覆盖率和 workspace 打包预检。

## TDD 记录

| 行为 | Red 命令与失败摘要 | Green 命令与结果 | Refactor 后结果 |
| --- | --- | --- | --- |
| Core 流式契约与状态 | `npx vitest run packages/core/src/Agent.test.ts`：6 failed、100 passed；缺少配置校验、partial 状态与 stream 路径 | 同命令：108 passed | 补充无效 iterator 后：109 passed |
| Core 错误、工具与竞态 | 同一 Red 覆盖非法完成值、Tool Call 流和取消清理 | 同命令：108 passed | `npm run check` 中 Core 与全量契约持续通过 |
| OpenAI-compatible SSE | `npx vitest run packages/openai-compatible/src/OpenAICompatibleAdapter.test.ts`：8 failed、22 passed；缺少 SSE、Tool Call、终止与取消路径 | 同命令：30 passed | 补充工厂和安全回调边界后：33 passed |

## 验证记录

| 检查 | 结果 | 备注 |
| --- | --- | --- |
| Core/Provider 聚焦测试 | 通过 | Core 109；OpenAI-compatible 33；Core 类型测试和 Provider typecheck 通过 |
| `npm run check` | 通过 | 6 files、175 tests；typecheck 和全部 workspace build 通过 |
| `npm run test:coverage` | 通过 | statements 90.35%、branches 85.26%、functions 90.95%、lines 94.39% |
| `npm pack --workspaces --dry-run` | 通过 | Core、JavaScript、OpenAI-compatible、UI 四个包预检通过 |

## 实施备注

- 本 change 仅完成 Core + Provider 基础；UI 增量投影必须在该契约验证后另行批准。
