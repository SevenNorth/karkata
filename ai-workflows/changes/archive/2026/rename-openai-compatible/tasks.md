# 实施任务：重命名 OpenAI 兼容协议包

## 任务

- [x] 1. Red：将聚焦测试切换到新公开名称并确认旧实现失败。
- [x] 2. Green：重命名包目录、源码、公开类型与导出。
- [x] 3. Refactor：同步 workspace、lockfile、测试别名、仓库约束和设计文档。
- [x] 4. 检索并清除当前源码和设计基线中的旧名称。
- [x] 5. 执行全仓、覆盖率、打包、声明和 change 验证。

## TDD 记录

| 行为 | Red 命令与失败摘要 | Green 命令与结果 | Refactor 后结果 |
| --- | --- | --- | --- |
| Provider 包与公开名称 | 工厂 2 项测试通过，Adapter 2 项因 `OpenAICompatibleAdapter is not a constructor` 失败 | 重命名源码和入口、同步 TS/Vitest 路径后聚焦测试 4/4 通过 | 新包 typecheck 通过；当前源码与设计基线旧名称检索为零 |

## 验证记录

| 检查 | 结果 | 备注 |
| --- | --- | --- |
| 聚焦测试 | 通过 | 新路径 `OpenAICompatibleAdapter.test.ts` 4/4 通过 |
| 旧名称检索 | 通过 | 源码、当前配置、README、设计基线和仓库约束无旧名称；历史 change 保留演进记录 |
| `npm run check` | 通过 | 类型检查、3 个测试文件 31/31、三个 workspace 构建通过 |
| coverage/build/pack | 通过 | 全仓行覆盖率 90.45%；顺序执行 clean/build/pack 后三个包产物完整，新包无旧类产物 |
| change 与 Git 检查 | 通过 | 新声明导出正确，change 校验与 `git diff --check` 通过 |
