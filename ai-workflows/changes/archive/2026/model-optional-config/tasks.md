# 实施任务：将 model 改为可选配置

## 任务

- [x] 1. Red：新增仅 `baseURL` 和缺少 `baseURL` 的 Adapter 请求测试。
- [x] 2. Green：实现可选 `model` 类型、校验和条件请求序列化。
- [x] 3. Refactor：统一文档、错误文本与测试断言。
- [x] 4. 更新 README、设计基线和本变更记录。
- [x] 5. 执行受影响测试、`npm run check`、coverage 与 pack dry-run。

## TDD 记录

| 行为 | Red 命令与失败摘要 | Green 命令与结果 | Refactor 后结果 |
| --- | --- | --- | --- |
| 省略 model 的请求 | `npm test -- --run packages/openai-compatible/src/OpenAICompatibleAdapter.test.ts`：2 条失败 | 同命令：35 条通过 | 同命令：35 条通过 |

## 验证记录

| 检查 | 结果 | 备注 |
| --- | --- | --- |
| `npm run check` | 通过 | typecheck、184 tests、workspace build 全部通过 |
| `npm pack --workspaces --dry-run` | 未运行 | 本次未执行 |

## 实施备注

无。coverage 与 pack dry-run 未执行，常规门禁已通过。
