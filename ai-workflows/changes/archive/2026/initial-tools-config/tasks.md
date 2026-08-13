# 实施任务：支持构造时批量配置工具

## 任务

- [x] 1. Red：为初始工具执行、显式 scope、冲突失败和数组隔离编写聚焦测试。
- [x] 2. Green：实现公开配置类型、原子批量注册和构造装配。
- [x] 3. Refactor：将批量能力收敛到 Registry 构造初始化，不暴露运行时批量追加方法。
- [x] 4. 更新 README 和仓库内工具注册设计文档。
- [x] 5. 执行全仓、覆盖率、打包和 change 验证。

## TDD 记录

| 行为 | Red 命令与失败摘要 | Green 命令与结果 | Refactor 后结果 |
| --- | --- | --- | --- |
| 构造时批量配置工具 | `npx vitest run packages/core/src/Agent.test.ts`：新增 4 个行为测试全部失败，工具列表为空、scope 注销失败、冲突未抛错、数组隔离失败；既有 7 个测试通过 | 实现配置类型与原子初始化后 11/11 通过，clean 后 typecheck 通过 | 增加空 scope 和 Registry 构造冲突测试，最终聚焦测试 13/13 通过 |

## 验证记录

| 检查 | 结果 | 备注 |
| --- | --- | --- |
| 聚焦测试 | 通过 | Core `Agent.test.ts` 13/13 通过 |
| `npm run check` | 通过 | 最终 3 个测试文件、17 个测试通过；typecheck 和三个 workspace 构建通过 |
| `npm run test:coverage` | 通过 | 17 个测试通过；总行覆盖率 82.44%，Core 行覆盖率 83.57% |
| clean/build/`npm pack --workspaces --dry-run` | 通过 | 三个 workspace 干净重建并完成发布包预检，新配置类型进入 Core 声明产物 |
| change 与 Git 检查 | 通过 | change 校验和 `git diff --check` 通过 |

## 实施备注

无。
