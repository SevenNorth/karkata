# 实施进度：完善模型错误分类与调试契约

## 当前状态

- 当前任务：完成验证并准备归档
- TDD 阶段：Red-Green-Refactor 完成
- 最后完成：全仓 check、覆盖率、打包、声明与 Git 检查
- 阻塞项：无

## 已修改文件

- `ai-workflows/changes/active/model-error-classification/*`
- `packages/core/src/Agent.test.ts`
- `packages/core/src/Agent.ts`
- `packages/core/src/errors.ts`
- `packages/core/src/index.ts`
- `packages/core/src/types.ts`
- `packages/openai-compatible/src/OpenAICompatibleAdapter.test.ts`
- `packages/openai-compatible/src/OpenAICompatibleAdapter.ts`
- `README.md`
- `docs/design/Karkata无头智能体运行时设计.md`

## 关键决策

- Core 通过 Provider 无关的 `ModelError` 接收标准化模型故障。
- 未知 Adapter 异常保留 `MODEL_ERROR` 兼容回退。
- 原始模型异常 cause、HTTP 响应正文、请求与认证数据不进入公开状态。
- OpenAI-compatible 只重试网络、429 和 5xx。
- 参考 page-agent 的结构化错误、重试元数据、HTTP 状态和取消穿透；不沿用 raw 请求/响应进入历史及未知错误默认重试。

## 验证记录

- 基线 `npm run check`：通过，3 个测试文件 44/44。
- draft change 校验：通过。
- Core Red：新增 6 项可靠失败，证明标准错误、分类和 retryable 契约缺失。
- Core Green：聚焦测试 36/36，Core 类型检查通过。
- Provider Red：新增 14 项可靠失败，证明分类缺失、敏感原错暴露和解析错误过度重试。
- Provider Green：分类、严格重试与安全消息实现后 18/18，Provider 类型检查通过。
- Refactor：补充 AbortError 穿透、已中断调用不执行宿主回调、迟到标准错误隔离、构造参数校验和工厂端到端状态；聚焦 60/60。
- 全仓 `npm run check`：通过，3 个测试文件 70/70，类型检查和三个包构建通过。
- 覆盖率：行 95.54%，分支 85.93%。
- workspace pack dry-run：通过，三个包产物完整。
- 声明检查：Core 导出 `ModelError`、`ModelErrorOptions`、`ModelErrorCode`；`AgentError` 公开 retryable/statusCode 且无 cause。
- change 最终校验：通过。
- `git diff --check`：通过；无 `.tgz` 或非预期生成文件。

## 下一步

- 最终校验 change，流转 completed 并归档。
