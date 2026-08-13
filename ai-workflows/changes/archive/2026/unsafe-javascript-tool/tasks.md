# 实施任务：明确非沙箱 JavaScript 工具 API

## 任务

- [x] 1. Red：测试从包公共入口导入并调用 `createUnsafeJavaScriptTool()`，记录缺少导出的失败。
- [x] 2. Green：重命名实现、类型与入口导出，使聚焦测试通过且执行语义不变。
- [x] 3. Refactor：统一源文件和测试文件命名，并增加旧工厂不导出的契约断言。
- [x] 4. 更新 README、AGENTS 和运行时设计文档中的定位、示例与安全说明。
- [x] 5. 执行聚焦测试、全仓检查、覆盖率、打包预检、change 校验和 Git 检查。

## TDD 记录

| 行为 | Red 命令与失败摘要 | Green 命令与结果 | Refactor 后结果 |
| --- | --- | --- | --- |
| 包仅公开非沙箱 JavaScript 工具工厂并保持执行行为 | `npx vitest run packages/javascript/src/createJavaScriptTool.test.ts`：1 个测试失败，`createUnsafeJavaScriptTool is not a function` | `npx vitest run packages/javascript/src/createUnsafeJavaScriptTool.test.ts`：1/1 通过 | 增加旧导出负向断言后：1 个文件、2 个测试通过；包 typecheck 通过 |

## 验证记录

| 检查 | 结果 | 备注 |
| --- | --- | --- |
| `npm test --workspace @karkata/javascript` | 失败（既有脚本问题） | workspace 工作目录下 `vitest run src` 与根 include 不匹配，未找到测试；改用根目录精确路径完成 TDD |
| `npm run check` | 通过 | 3 个测试文件、11 个测试通过；typecheck 与三个 workspace 构建通过 |
| `npm run test:coverage` | 通过 | 11 个测试通过；JavaScript 源文件行覆盖率 100% |
| `npm run clean && npm run build && npm pack --workspaces --dry-run` | 通过 | JavaScript tarball 只包含 `createUnsafeJavaScriptTool.*` 和新入口 |
| `npm run ai:change:validate -- unsafe-javascript-tool` | 通过 | 提案与设计在实施前校验通过；最终归档前再次运行 |
| `git diff --check` | 通过 | 无空白错误 |

## 实施备注

- 用户明确要求不保留旧工厂，因此不提供 deprecated alias。
- JavaScript 包已有的 workspace `test` 脚本无法发现测试，不属于本次公共 API 改名范围；全仓根测试已覆盖该包。
- 首次并行打包预检发现旧 `dist` 生成文件残留；使用仓库 `clean` 脚本后串行重建，最终 tarball 已确认只包含新 API。
