# 实施进度：完善双语文档并部署 GitHub Pages

## 当前状态

- 当前任务：任务 8/9，提交并推送后跟踪 Pages workflow，执行远端 smoke
- TDD 阶段：本地 Red-Green-Refactor 与完整门禁已完成
- 最后完成：完整本地门禁与 production browser QA；26 路由、搜索、Demo、发布与四包边界通过
- 阻塞项：`https://sevennorth.github.io/karkata/` 与公开 Pages API 当前均返回 404；等待 push 后的 GitHub Actions/Pages 外部状态

## 已修改文件

- `ai-workflows/changes/active/docs-content-pages/proposal.md`
- `ai-workflows/changes/active/docs-content-pages/design.md`
- `ai-workflows/changes/active/docs-content-pages/tasks.md`
- `ai-workflows/changes/active/docs-content-pages/progress.md`
- `scripts/docs/example-fixtures.test.mjs`
- `website/examples/**`
- `website/**/*.md`、`website/page-manifest.mjs`
- `website/.vitepress/config.mts`
- `website/public/images/**`
- `.github/workflows/docs-pages.yml`
- `scripts/docs/pages-workflow.test.mjs`
- `scripts/docs/site-contract.mjs`、`scripts/docs/static-output.mjs`、相邻测试与 browser smoke
- `package.json`、`package-lock.json`

## 关键决策

- 本 change 依赖第一阶段 `docs-demo-site`，不重复站点基础或 Demo Runtime。
- 已确认默认部署 URL 为 `https://sevennorth.github.io/karkata/`，base 为 `/karkata/`。
- 完整内容按声明式 page ID 中英文镜像，示例由严格类型 fixture 覆盖。
- 视觉资产只使用 production Demo 的实际桌面/移动截图。
- PR 只 build/test，`main` 或手动流程才以最小权限部署 Pages。
- Pages 使用 Actions artifact，不创建或维护 `gh-pages` 分支，构建目录不进入 Git 历史。
- README 只在远端 URL 验证成功后加入站点链接。

## 验证记录

- 用户已确认两阶段拆分、VitePress、默认 GitHub Pages 地址、视觉基线和 Actions artifact 部署方式。
- 用户已于 2026-08-17 明确批准本 change，状态已流转至 implementing。
- 用户已于 2026-08-17 明确授权提交并推送本 change 改动。
- 创建本 change 时没有实施站点、修改 workflow 或访问 GitHub Pages 设置。
- 本地 TDD、站点 build、浏览器 QA、覆盖率、发布与 package smoke 均已完成。
- `npm run check`：182 项测试、类型检查和四个 workspace build 通过。
- `npm run test:docs`：12 项测试及 13 组页面通过；production build 生成并验证 26 个路由。
- `npm run test:docs:browser`：桌面/移动、26 路由、本地搜索、Demo、控制台和同源网络通过。
- `npm run test:coverage`：statements 90.52%，lines 94.45%。
- `npm run test:release`：7 项通过；`npm run test:package`：4 个 tarball smoke 通过。
- `npm pack --workspaces --dry-run`：仅四个发布包。
- 外部状态：稳定 URL 与 GitHub Pages API 均返回 404，尚未部署。
- 第一阶段 `docs-demo-site` 已通过 production 浏览器 QA、发布门禁和四包 tarball 边界验证。

## 下一步

- 提交并推送到 `main`，跟踪 Pages workflow；如仓库尚未启用 Pages，设置 Source = GitHub Actions，部署成功后运行远端 smoke，再更新 README、完成任务 8/9 并归档。
