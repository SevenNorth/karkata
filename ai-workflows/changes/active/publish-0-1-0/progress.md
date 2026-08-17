# 实施进度：发布 Karkata 0.1.0

## 当前状态

- 当前任务：任务 7，创建 `v0.1.0` tag 和 GitHub Release
- TDD 阶段：scope 迁移、四包发布和 registry 消费验证已完成
- 最后完成：四个 `@karkata-ai/*@0.1.0` 已发布，registry tarball 消费 smoke 通过
- 阻塞项：无

## 已修改文件

- `ai-workflows/changes/active/publish-0-1-0/{proposal,design,tasks,progress}.md`

## 关键决策

- 使用 `publish-0-1-0` 代替含点号的 `publish-0.1.0`，因为脚本要求 kebab-case change ID。
- 发布顺序为 Core、OpenAI-compatible、JavaScript、UI；失败即停。
- npm publish、tag 和 GitHub Release 均是外部动作，未经实施阶段和前置检查不执行。
- 旧 scope 从未发布，不提供兼容包；当前代码和长期文档统一迁移，已归档 change 保持历史原貌。
- 用户明确选择 `karkata-ai`、批准 scope 迁移，并维持单一发布 change。

## 验证记录

- `npm whoami`：失败，`ENEEDAUTH`；未登录 npm。
- `gh auth status`：失败，GitHub CLI 未登录。
- `git status`：仅有 `ai-workflows/changes/active/publish-0-1-0/` 未跟踪草案。
- 重新认证后 `npm whoami` 返回 `qibeidu`；先前原组织权限记录已由用户纠正为该组织属于他人。
- 重新认证后 `gh auth status` 与 `gh api user` 确认账户 `SevenNorth`。
- npm registry：四个 `@karkata-ai/*@0.1.0` 查询均为 404，尚未公开发布。
- `npm ci` 完成；`npm audit --omit=dev` 为 0 vulnerabilities。
- `npm run check`：182 项测试与四包 build 通过；release 7 项、coverage 90.52% statements/94.45% lines、四包 package smoke 通过。
- 四包 `npm publish --dry-run --json`：Core 44、OpenAI-compatible 16、JavaScript 12、UI 20 个文件，全部为 public latest。
- 真实 Provider 环境变量未提供，按批准方案记录为未运行。
- 首次原 scope Core publish：`E403`，要求 2FA OTP 或 bypass 2FA token；registry 复核未写入。
- 用户确认原组织不属于自己且无法联系；改用新组织 `karkata-ai`。
- `npm org ls karkata-ai`：返回 `qibeidu - owner`。
- scope 迁移首次 `npm run check`：因 `node_modules` 保留旧 workspace 链接导致新 Core 包名无法解析；运行 `npm install --ignore-scripts` 刷新链接后通过。
- 迁移后 `npm run check`：182 项测试与四包构建通过；`npm run test:docs` 12 项通过；release 7 项通过；coverage 90.52% statements/94.45% lines。
- `npm run test:package`：四个 tarball 通过；`npm pack --workspaces --dry-run --json` 与四包 `npm publish --dry-run --json` 均通过，文件数依次为 44、16、12、20。
- `npm audit --omit=dev`：0 vulnerabilities；当前代码和长期文档无原 scope 字面引用，历史归档除外。
- 四包真实发布：`@karkata-ai/core`、`@karkata-ai/openai-compatible`、`@karkata-ai/javascript`、`@karkata-ai/ui` 均成功返回 `+ ...@0.1.0`。
- registry 精确版本 API：四包均返回 `0.1.0`，三个下游包的 Core 依赖均为 `@karkata-ai/core@0.1.0`。
- 首次标准名称安装短暂命中 npm packument 的旧 404；改用 API 返回的官方 registry tarball URL 后，四包安装、TypeScript、ESM、Provider 构造和 `@karkata-ai/ui/web-component` 验证通过。

## 下一步

- 提交并推送发布证据，创建并推送 annotated `v0.1.0` tag，再创建并核对 GitHub Release。
