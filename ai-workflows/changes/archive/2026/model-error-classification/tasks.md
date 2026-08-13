# 实施任务：完善模型错误分类与调试契约

## 任务

- [x] 1. Core Red：增加标准化模型错误到 `AgentResult`/`AgentState` 的分类、重试标记、HTTP 状态、安全消息与历史回归测试。
- [x] 2. Core Green：实现 `ModelError` 公共边界、`AgentError` 契约和 `Agent.send()` 映射。
- [x] 3. Provider Red：增加网络、HTTP、响应解析分类以及重试次数和敏感信息隔离测试。
- [x] 4. Provider Green：实现 OpenAI-compatible 错误归一化和严格重试分类。
- [x] 5. Refactor：收敛错误创建/响应解析结构，检查取消优先级、包入口和声明输出。
- [x] 6. 更新 README 与 Runtime 设计基线，并检查契约遗漏。
- [x] 7. 执行聚焦测试、全仓 check、覆盖率、打包预检、change 与 Git 检查并记录结果。

## TDD 记录

| 行为 | Red 命令与失败摘要 | Green 命令与结果 | Refactor 后结果 |
| --- | --- | --- | --- |
| Core 模型错误映射 | `npx vitest run packages/core/src/Agent.test.ts`：新增 6 项失败；五类均因 `ModelError is not a constructor` 落入 `MODEL_ERROR`，普通异常缺少 `retryable` | 新增标准错误、导出和 Core 映射后 36/36；Core `tsc --noEmit` 通过 | 增加元数据运行时校验、未知异常固定安全消息及迟到错误隔离后，与 Provider 合并聚焦 60/60 |
| OpenAI-compatible 分类与重试 | 聚焦测试新增 14 项失败：私有 HTTP/网络/Zod/JSON/宿主回调原错未归一化，解析错误重复请求 3 次 | 集中 HTTP 和响应解析边界、仅按 `ModelError.retryable` 重试后 18/18，Provider 类型检查通过 | 增加 fetch/响应读取 AbortError 穿透、已中断调用不执行宿主回调和工厂端到端状态测试；合并聚焦 60/60 |

## 验证记录

| 检查 | 结果 | 备注 |
| --- | --- | --- |
| 聚焦测试 | 通过 | Core + OpenAI-compatible 2 个文件 60/60 |
| `npm run check` | 通过 | 类型检查、3 个测试文件 70/70、三个 workspace 构建通过 |
| `npm run test:coverage` | 通过 | 行覆盖率 95.54%，分支覆盖率 85.93% |
| `npm pack --workspaces --dry-run` | 通过 | 三个包产物完整，Core 声明包含标准错误契约 |
| change / Git 检查 | 通过 | change 最终校验与 `git diff --check` 通过，无 `.tgz` 或非预期文件 |

## 实施备注

- 参考 page-agent 的结构化错误、retryable、statusCode 和 AbortError 穿透；未沿用 raw 请求/响应进入历史及未知错误默认重试。
- 安全审查将未分类 Adapter 异常的公开 message 收敛为固定文本；保留 `MODEL_ERROR` 兼容分类，不暴露原异常。
- 内容过滤和上下文长度保持非目标，后续结合上下文预算单独设计。
