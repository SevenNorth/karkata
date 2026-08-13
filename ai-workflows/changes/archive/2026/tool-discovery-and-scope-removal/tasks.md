# 实施任务：增加工具查询与作用域移除接口

## 任务

- [x] 1. Red：为工具列表、scope 列表、过滤、只读快照、删除和 dispose 编写测试。
- [x] 2. Green：实现公开投影类型、Registry 能力和 Agent API。
- [x] 3. Refactor：统一 scope 校验并检查无内部字段泄漏和空 scope 生命周期。
- [x] 4. 更新 README 和工具设计基线。
- [x] 5. 执行全仓、覆盖率、打包、声明和 change 验证。

## TDD 记录

| 行为 | Red 命令与失败摘要 | Green 命令与结果 | Refactor 后结果 |
| --- | --- | --- | --- |
| 查询工具与 scope、移除 scope | `npx vitest run packages/core/src/Agent.test.ts`：5 个新增测试因 `listTools`、`listToolScopes`、`removeToolScope` 不存在而失败，既有 13 个测试通过 | 实现投影、scope Set 和显式删除后 18/18 通过；clean typecheck 通过 | 收紧投影不暴露 Schema，补充空 scope 与单工具注销语义后 18/18 通过 |

## 验证记录

| 检查 | 结果 | 备注 |
| --- | --- | --- |
| 聚焦测试 | 通过 | Core `Agent.test.ts` 18/18 通过 |
| `npm run check` | 通过 | 3 个测试文件、22 个测试通过；typecheck 和三个 workspace 构建通过 |
| `npm run test:coverage` | 通过 | 总行覆盖率 88.09%，Core 行覆盖率 90.74% |
| clean/build/pack dry-run | 通过 | 三个 workspace 干净重建并通过发布包预检；Core 声明包含三个方法和精简投影 |
| change 与 Git 检查 | 通过 | change 校验、声明扫描和 `git diff --check` 通过 |

## 实施备注

- 用户在初始 Red 测试写入后要求 `listToolScopes()` 返回全部 scope，不考虑是否为空；change revise 后重新批准实施。
- `removeToolScope()` 删除空 scope 与不存在 scope 都返回 `0`，可通过删除前后的 `listToolScopes()` 区分。
