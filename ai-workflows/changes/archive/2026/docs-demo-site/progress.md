# 实施进度：建设双语文档与交互演示站点

## 当前状态

- 当前任务：完成验收并归档第一阶段
- TDD 阶段：Red-Green-Refactor 与完整验证已完成
- 最后完成：production 浏览器 QA、覆盖率和四包发布边界验证
- 阻塞项：无

## 已修改文件

- `package.json`、`package-lock.json`、`.gitignore`
- `website/**`
- `scripts/docs/**`
- `examples/ui-demo/demo-agent.mjs`
- `examples/ui-demo/demo-agent.test.mjs`
- `ai-workflows/changes/active/docs-demo-site/**`
- `ai-workflows/changes/active/docs-content-pages/progress.md`

## 关键决策

- 已拆为两个 change；本 change 是站点基础与离线 Demo。
- 已确认 VitePress/Vue 只作为根开发依赖，不加入发布 workspaces。
- 已确认中文 `/`、英文 `/en/`，未来 GitHub Pages base 为 `/karkata/`。
- 已确认使用 GitHub Actions Pages artifact 部署，不创建 `gh-pages` 构建产物分支。
- 已确认白色、炭灰、绿色主基线与克制蓝色辅助色。
- 首页直接提供快速开始与实际离线 Demo，不建设纯营销 Hero。
- 确定性 Demo Agent 是唯一行为源，不复制状态机。
- 静态站不接收 API Key、不连接真实 Provider、不包含分析与第三方 CDN。
- VitePress 1.6.4、Vue 3.5.41 和 Playwright Core 1.62.1 仅为根开发依赖。
- 浏览器 smoke 使用本机 Edge，并验证 production 站点没有外部网络请求。

## 验证记录

- `npm run check`：182 项测试、类型检查和四个包构建通过。
- `npm run test:ui-demo`：8 项通过；`npm run test:docs`：7 项及 4 组页面配对通过。
- `npm run test:docs:browser`：8 个 `/karkata/` 路由、桌面/移动、中英文、Demo 交互、reduced-motion、控制台和网络检查通过。
- `npm run test:release`：7 项通过；`npm run test:coverage`：statements 90.52%，lines 94.45%。
- `npm run test:package`：4 个 tarball smoke 通过；`npm pack --workspaces --dry-run`：仅四个发布包。
- `git diff --check`：通过。

## 下一步

- 流转 completed 并归档；第二阶段 `docs-content-pages` 保持 draft，等待单独审查和批准。
