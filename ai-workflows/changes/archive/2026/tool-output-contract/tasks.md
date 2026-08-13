# 实施任务：约束工具返回值契约

## 任务

- [x] 1. Red：增加工具输出类型正例与 `void`/`undefined` 负例测试。
- [x] 2. Green：新增 `ToolOutput` 并收紧 `Tool`、`defineTool()` 泛型。
- [x] 3. Red：增加 JavaScript 工具动态输出的有效值与无效值测试。
- [x] 4. Green：将 JavaScript 工具输出收紧为 `ToolOutput` 并实现递归运行时校验。
- [x] 5. Refactor：增加 Core 运行时递归结构和不可序列化值回归测试。
- [x] 6. 更新 README、Runtime 设计和工具注册设计文档。
- [x] 7. 执行全仓、覆盖率、打包、声明和 change 验证。

## TDD 记录

| 行为 | Red 命令与失败摘要 | Green 命令与结果 | Refactor 后结果 |
| --- | --- | --- | --- |
| 工具输出类型契约 | 专用 `tsc` 报告 `ToolOutput` 未导出，且 `undefined`/`void` 两处 `@ts-expect-error` 未使用 | 新增公开类型与 `defineTool()` 递归校验后专用类型测试通过 | 增加 bigint/function/symbol/undefined 属性负例与命名 DTO 正例；接入根 typecheck 门禁 |
| JavaScript 工具动态输出 | 全仓 typecheck 暴露 `unknown` 不满足 `ToolOutput`；直接调用的 5 类无效值均被原样返回 | 增加递归动态校验后 8/8 通过 | 扩展 symbol、非有限数字边界，最终 10/10 通过 |
| Core 运行时兜底 | 非有限数字、class 实例和 symbol 属性被静默转换为合法结果，3 项失败 | 增加最终 ToolOutput 校验与序列化后通过 | Core 聚焦测试 30/30 通过，覆盖结构化值、循环引用和类型绕过 |

## 验证记录

| 检查 | 结果 | 备注 |
| --- | --- | --- |
| Core 聚焦检查 | 通过 | Core 30/30、JavaScript 10/10；专用类型正负例通过 |
| `npm run check` | 通过 | 根类型门禁、3 个测试文件 44/44、三个 workspace 构建通过 |
| coverage/build/pack | 通过 | 全仓行覆盖率 92.13%；顺序执行 clean/check/coverage/pack dry-run 通过 |
| 声明、change 与 Git 检查 | 通过 | Core 公开 `ToolOutput`/受约束 `defineTool()`；JavaScript 返回 `ToolOutput`；change 与 `git diff --check` 通过 |
