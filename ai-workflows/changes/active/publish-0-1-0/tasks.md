# 实施任务：发布 Karkata 0.1.0

## 任务

- [x] 1. Red/Green：将当前仓库公开包 scope 从旧组织迁移至 `@karkata-ai/*`，更新 lockfile，并确认当前文件无旧 scope 残留（历史归档除外）。
- [x] 2. 重新验证 npm/GitHub 身份、`karkata-ai` 组织权限、四包版本、工作区和发布物前置。
- [x] 3. 重新运行本地完整门禁、发布/包 smoke、coverage 和 dry-run pack，确认四包发布白名单。
- [x] 4. 在受控凭据存在时运行真实 Provider smoke，检查脱敏输出；无凭据则记录未运行。
- [ ] 5. 按依赖顺序发布四个 npm 包，任一失败立即停止并记录版本、registry 和错误分类。
- [ ] 6. 从 npm registry 临时安装四包，运行 ESM、TypeScript、UI 子路径和本地 Provider 消费验证。
- [ ] 7. 四包验证通过后创建并推送 `v0.1.0` tag，创建 GitHub Release 并核对 commit/tag 关联。
- [ ] 8. 更新验证记录，确认工作区干净，流转 completed 并归档 change。

## TDD 记录

| 行为 | Red 命令与失败摘要 | Green 命令与结果 | Refactor 后结果 |
| --- | --- | --- | --- |
| 发布前置与发布物 | `npm whoami`：`ENEEDAUTH`；`gh auth status`：未登录；工作区含未跟踪 change 草案 | npm `qibeidu` 与 GitHub `SevenNorth` 已登录；Node/npm、registry、四包版本和未发布状态正确 | 迁移后完整门禁与四包 publish dry-run 通过；生产依赖审计为 0 |
| npm scope 迁移 | 原组织属于他人，发布者无法使用原 scope；首次 typecheck 因旧 workspace 链接无法解析新包名 | 刷新 workspace 链接后 `npm run check` 通过，当前文件无旧 scope 残留 | release、docs、coverage、package smoke 与四包 dry-run 均通过 |
| registry 消费与版本一致性 | 待执行 | 待执行 | 待执行 |
| tag/Release 外部状态 | 待执行 | 待执行 | 待执行 |

## 验证记录

| 检查 | 结果 | 备注 |
| --- | --- | --- |
| `npm whoami`、scope/registry 权限 | 通过 | npm `qibeidu` 为 `karkata-ai` owner；官方 registry；四个 `@karkata-ai/*@0.1.0` 当前均未发布 |
| `npm run check`、release/package smoke、coverage、dry-run pack | 通过 | 182 项测试；release 7 项；statements 90.52%、lines 94.45%；四包 package smoke 和 publish dry-run 通过 |
| 真实 Provider smoke | 未运行 | `KARKATA_BASE_URL`、`KARKATA_API_KEY`、`KARKATA_MODEL` 均未提供，按批准方案记录 |
| npm publish、registry consumer、tag、Release | 待执行 | 原 scope 的 Core publish 曾返回 `E403`；迁移后四包 dry-run 已通过，真实发布仍需验证新组织 token 权限 |

## 实施备注

规模评估涉及四包和配套文档，但 scope 迁移与首次发布属于同一不可分割验收目标；用户再次明确批准不拆分，按任务阶段失败即停。

首次 Core `npm publish` 在 registry 写入前因 2FA 要求返回 `E403`；确认版本仍不存在，未尝试后续包，也未执行补偿性 unpublish。
