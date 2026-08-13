# 实施任务：增加 OpenAI Agent 便捷工厂

## 任务

- [x] 1. Red：增加公开工厂的返回类型、Provider 请求和 Runtime 配置行为测试。
- [x] 2. Green：实现 `OpenAICreateAgentConfig`、`createAgent()` 和包入口导出。
- [x] 3. Refactor：收敛配置拆分与覆盖顺序，确认 Core 依赖边界不变。
- [x] 4. 更新 README 与 Runtime 设计文档。
- [x] 5. 执行全仓、覆盖率、打包、声明和 change 验证。

## TDD 记录

| 行为 | Red 命令与失败摘要 | Green 命令与结果 | Refactor 后结果 |
| --- | --- | --- | --- |
| OpenAI Agent 工厂 | 根目录聚焦运行：既有 2 项通过，新增测试因 `createAgent is not a function` 失败 | 新增工厂模块与包入口后 3/3 通过 | 增加 `agent.llm` 类型排除断言后 4/4 通过，OpenAI 包 typecheck 通过 |

## 验证记录

| 检查 | 结果 | 备注 |
| --- | --- | --- |
| OpenAI 聚焦测试 | 通过 | `OpenAIAdapter.test.ts` 4/4 通过；既有 workspace 测试脚本因根 Vitest include 与工作目录组合无法发现测试，改用根目录聚焦命令 |
| `npm run check` | 通过 | 类型检查、3 个测试文件 31/31、三个 workspace 构建通过 |
| coverage/build/pack | 通过 | 全仓行覆盖率 90.45%；workspace pack dry-run 包含工厂 JS 与声明文件 |
| change 与 Git 检查 | 通过 | 生成声明符合公开契约，Core 依赖未变，change 校验和 `git diff --check` 通过 |
