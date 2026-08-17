# 实施进度：发布 Karkata 0.1.0

## 当前状态

- 当前任务：提交 change 文档后进入任务 2 完整发布门禁
- TDD 阶段：发布前置 Red-Green 已完成
- 最后完成：npm `qibeidu`/`karkata` owner 与 GitHub `SevenNorth` 身份通过；用户授权提交 change 文档
- 阻塞项：无；提交后复核干净工作区

## 已修改文件

- `ai-workflows/changes/active/publish-0-1-0/{proposal,design,tasks,progress}.md`

## 关键决策

- 使用 `publish-0-1-0` 代替含点号的 `publish-0.1.0`，因为脚本要求 kebab-case change ID。
- 发布顺序为 Core、OpenAI-compatible、JavaScript、UI；失败即停。
- npm publish、tag 和 GitHub Release 均是外部动作，未经实施阶段和前置检查不执行。

## 验证记录

- `npm whoami`：失败，`ENEEDAUTH`；未登录 npm。
- `gh auth status`：失败，GitHub CLI 未登录。
- `git status`：仅有 `ai-workflows/changes/active/publish-0-1-0/` 未跟踪草案。
- 重新认证后 `npm whoami` 返回 `qibeidu`，`npm org ls karkata` 返回 owner。
- 重新认证后 `gh auth status` 与 `gh api user` 确认账户 `SevenNorth`。
- npm registry：`@karkata/core` 查询 404，尚未公开发布。

## 下一步

- 提交 change 文档，确认工作区干净后运行任务 2 完整发布门禁。
