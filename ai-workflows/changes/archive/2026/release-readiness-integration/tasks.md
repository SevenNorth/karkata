# 实施任务：准备 0.1.0 发布与真实集成验证

## 任务

- [x] 1. Red：新增四包发布元数据、tarball 文件白名单和敏感文件黑名单测试，记录当前 README/LICENSE/字段缺失。
- [x] 2. Green：补齐根与四包发布元数据和许可证打包策略，使发布物结构测试通过。
- [x] 3. 编写根目录中文/英文 README，统一语言导航、定位、包选择、快速开始、安全和开发内容。
- [x] 4. 编写四个包的中文/英文 README，并让公开 API 示例进入可执行类型 fixture。
- [x] 5. Red：新增隔离 tarball 消费者测试，覆盖 ESM 导入、TypeScript 类型、UI 子路径和本地假 OpenAI-compatible 服务，记录预期失败。
- [x] 6. Green：实现临时 pack/install/smoke harness，确保安全清理且不在仓库残留 tarball。
- [x] 7. Red：新增真实 Provider smoke 配置、脱敏和结果判定测试，记录脚本缺失或行为缺失。
- [x] 8. Green：实现显式 opt-in 真实 Provider smoke 命令，不接入默认测试或 CI。
- [x] 9. Refactor：统一发布脚本错误输出、进程调用、临时目录和文档示例来源，保持全部聚焦测试通过。
- [x] 10. 更新发布检查文档和设计路线图，明确 checkpoint 暂缓、真实 smoke 边界与人工发布步骤。
- [x] 11. 执行 `npm run check`、`npm run test:coverage`、隔离 tarball smoke 和 `npm pack --workspaces --dry-run`，记录结果并人工核对四个文件清单。

## TDD 记录

| 行为 | Red 命令与失败摘要 | Green 命令与结果 | Refactor 后结果 |
| --- | --- | --- | --- |
| 发布元数据与 tarball 内容 | `node --test scripts/release/package-metadata.test.mjs`：2 项失败，缺少 `license` 和根 LICENSE | 同命令：2 项通过 | `npm run test:release`：7 项通过 |
| 隔离消费者导入和类型 | `node --test scripts/release/package-smoke.test.mjs`：`ERR_MODULE_NOT_FOUND` | 同命令：2 项通过；`npm run test:package`：4 个 tarball 通过 | 最终 `npm run test:package`：通过 |
| 真实 smoke 配置与脱敏 | `node --test scripts/release/real-provider-smoke.test.mjs`：`ERR_MODULE_NOT_FOUND` | 同命令：3 项通过 | `npm run test:release`：7 项通过 |

## 验证记录

| 检查 | 结果 | 备注 |
| --- | --- | --- |
| `npm pack --workspaces --dry-run --json`（基线） | 通过但不满足发布验收 | 四包只包含 `dist` 与 `package.json`，缺少 README/LICENSE |
| `npm run check` | 通过 | 类型检查、182 项 Vitest、四包构建通过 |
| `npm run test:release` | 通过 | 7 项 Node release 测试通过 |
| `npm run test:coverage` | 通过 | statements 90.52%、branches 85.72%、functions 91.18%、lines 94.45% |
| tarball consumer smoke | 通过 | 四包 tarball 安装、类型、ESM、本地 Provider 和 UI 子路径通过 |
| `npm pack --workspaces --dry-run --json` | 通过 | 四包必需文件齐全，意外文件均为 0 |
| 真实 Provider smoke | 未运行 | 未提供受控 Provider 凭据；配置、脱敏、结果判定已由本地测试覆盖 |

## 实施备注

- 规模评估触发大型变更拆分条件：涉及四个包、workspace、示例和文档，共 11 项任务。
- 建议保留一个 change，以共同的“0.1.0 可发布”验收目标管理；实施分为发布物/双语文档、集成验证两个阶段，并建议在用户授权后拆成两个提交。
- 实际 `npm publish`、Git tag 和 release 不在本 change 范围。
- 真实外部 Provider 未调用，剩余兼容性风险由发布者按 `docs/RELEASING.md` 在受控环境验证。
