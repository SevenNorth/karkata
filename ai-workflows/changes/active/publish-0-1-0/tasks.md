# 实施任务：发布 Karkata 0.1.0

## 任务

- [x] 1. Red：验证 npm/GitHub 身份、scope 权限、四包版本、干净工作区和发布物前置；记录未登录或权限不足时的失败。
- [x] 2. Green：运行本地完整门禁、发布/包 smoke、coverage 和 dry-run pack，确认四包发布白名单。
- [x] 3. Refactor：在受控凭据存在时运行真实 Provider smoke，检查脱敏输出；无凭据则记录未运行。
- [ ] 4. 按依赖顺序发布四个 npm 包，任一失败立即停止并记录版本、registry 和错误分类。
- [ ] 5. 从 npm registry 临时安装四包，运行 ESM、TypeScript、UI 子路径和本地 Provider 消费验证。
- [ ] 6. 四包验证通过后创建并推送 `v0.1.0` tag，创建 GitHub Release 并核对 commit/tag 关联。
- [ ] 7. 更新验证记录，确认工作区干净，流转 completed 并归档 change。

## TDD 记录

| 行为 | Red 命令与失败摘要 | Green 命令与结果 | Refactor 后结果 |
| --- | --- | --- | --- |
| 发布前置与发布物 | `npm whoami`：`ENEEDAUTH`；`gh auth status`：未登录；工作区含未跟踪 change 草案 | npm `qibeidu` 为 `karkata` owner；GitHub `SevenNorth` 已登录；Node/npm、registry、四包版本和未发布状态正确 | 完整门禁与四包 publish dry-run 通过；生产依赖审计为 0 |
| registry 消费与版本一致性 | 待执行 | 待执行 | 待执行 |
| tag/Release 外部状态 | 待执行 | 待执行 | 待执行 |

## 验证记录

| 检查 | 结果 | 备注 |
| --- | --- | --- |
| `npm whoami`、scope/registry 权限 | 通过 | npm `qibeidu` 为 `karkata` owner；官方 registry；四个 `@karkata/*@0.1.0` 当前均未发布 |
| `npm run check`、release/package smoke、coverage、dry-run pack | 通过 | 182 项测试；release 7 项；statements 90.52%、lines 94.45%；四包 package smoke 和 publish dry-run 通过 |
| 真实 Provider smoke | 未运行 | `KARKATA_BASE_URL`、`KARKATA_API_KEY`、`KARKATA_MODEL` 均未提供，按批准方案记录 |
| npm publish、registry consumer、tag、Release | 阻塞 | Core publish 返回 `E403`，要求 2FA OTP 或允许 bypass 2FA 的 granular token；Core 未发布，后续包已停止 |

## 实施备注

规模评估涉及四包但只有一个版本发布验收目标，建议不拆多个 change；按任务阶段失败即停，便于恢复且避免各包审批边界不一致。

首次 Core `npm publish` 在 registry 写入前因 2FA 要求返回 `E403`；确认版本仍不存在，未尝试后续包，也未执行补偿性 unpublish。
