# 变更提案：发布 Karkata 0.1.0

## 背景

Karkata 0.1.0 的四个 workspace 已完成 Runtime、UI、双语文档站和发布物验证，但 npm registry 尚无公开包、仓库也没有版本 tag。原计划使用的 `karkata` npm 组织属于他人且无法联系；发布者已经创建并拥有 `karkata-ai` 组织，因此首次公开发布前需统一迁移 npm scope。

## 目标

- 将 `@karkata-ai/core`、`@karkata-ai/openai-compatible`、`@karkata-ai/javascript` 和 `@karkata-ai/ui` 以 `0.1.0` 发布到 npm public registry。
- 在发布前完成本地门禁、tarball 文件清单和可选真实 Provider smoke；发布后从 registry 临时项目验证 ESM、类型、UI 子路径和依赖安装。
- 所有四包成功后创建 `v0.1.0` tag 并创建 GitHub Release，记录 commit、包版本、workflow 和验证结果。

## 范围

- 核对 Node/npm、干净工作区、四包版本、npm scope 权限、2FA/OTP 或 trusted publishing 和 registry。
- 运行 `npm run check`、`npm run test:release`、`npm run test:coverage`、`npm run test:package` 与 workspace dry-run pack。
- 在用户提供受控环境变量时运行 `npm run test:integration:real`；未提供时记录为未运行，不伪造通过。
- 按 Core、OpenAI-compatible、JavaScript、UI 顺序执行 `npm publish`，任一失败立即停止后续包。
- 发布后在临时目录从 npm registry 安装四包并运行消费者 smoke；全部成功后创建 tag 和 GitHub Release。
- 更新发布 change 的验证证据并归档。
- 将当前源码、包元数据、内部依赖、测试、发布脚本、README、站点和设计基线中的公开包从原 scope 统一迁移为 `@karkata-ai/*`。

## 非目标

- 不修改 Runtime、消息、工具、状态、取消、超时或 Provider 契约。
- 不重写已归档 change 的历史记录，也不为原 scope 创建兼容占位包。
- 不自动登录 npm、读取或写入 token/OTP，不把凭据写入仓库、日志或 Release。
- 不自动提升版本号；本 change 只发布现有 `0.1.0`。
- 不覆盖已发布的同版本，不执行 unpublish；发现包问题时停止并制定新的 patch 版本 change。
- 不在没有四包完整发布和 registry smoke 证据时创建 tag 或 Release。

## 验收标准

- [x] 四个包均以 `0.1.0` 出现在 npm public registry，包名、访问级别和 README/LICENSE 文件正确。
- [x] 当前代码、文档、测试和发布配置只引用 `@karkata-ai/*`；历史归档记录除外。
- [x] 发布前 `npm run check`、发布测试、coverage、package smoke 和 dry-run pack 通过。
- [x] 真实 Provider smoke 已在受控环境运行并记录，或明确记录未提供凭据且不阻塞本地发布门禁。
- [x] 新临时项目可从 registry 安装四个包，完成 ESM、TypeScript、UI web-component 子路径和本地 Provider 消费验证。
- [ ] 只有四包全部验证通过后才创建并推送 `v0.1.0` tag。
- [ ] GitHub Release `v0.1.0` 创建成功，关联正确 tag/commit，未包含凭据或未脱敏请求。
- [ ] change 文档记录 npm 版本、tag、Release URL、commit 和剩余风险，并归档。

## 风险

- npm scope 权限、2FA/OTP、trusted publishing 或网络状态可能阻塞首次发布；新组织和 granular token 的权限需分别验证。
- npm 同版本不可覆盖；发布顺序和失败即停用于避免依赖包处于半发布状态。
- 真实 Provider 可能产生费用或暴露业务数据，只允许短期凭据、固定无业务提示和脱敏结果。
- GitHub CLI 未登录时不能创建 Release；不能用扩大权限或提交 token 绕过。

## 待确认项

- 规模评估涉及四个发布包，触发大型变更拆分检查；建议因共同的 `0.1.0` 验收目标保留一个 change，在 tasks 内按前置门禁、逐包发布、registry 验证、tag/Release 分阶段执行，请用户确认不拆分。
- 发布者需在实施前确认 npm 登录账户拥有 `@karkata-ai` scope 的 public publish 权限。
- 发布者需决定是否提供 `KARKATA_BASE_URL`、`KARKATA_API_KEY`、`KARKATA_MODEL` 运行真实 Provider smoke。
- 发布者需确认 GitHub CLI 或其他受控方式具备创建 tag 和 Release 的权限。
