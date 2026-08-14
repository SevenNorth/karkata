# 实施进度：完善双语文档并部署 GitHub Pages

## 当前状态

- 当前任务：第一阶段依赖已满足，等待第二阶段审查
- TDD 阶段：尚未开始
- 最后完成：确认 `docs-demo-site` 的 8 个双语路由、共享 Demo 和 `/karkata/` production build 已验收
- 阻塞项：等待用户单独批准第二阶段；当前 change 保持 draft

## 已修改文件

- `ai-workflows/changes/active/docs-content-pages/proposal.md`
- `ai-workflows/changes/active/docs-content-pages/design.md`
- `ai-workflows/changes/active/docs-content-pages/tasks.md`
- `ai-workflows/changes/active/docs-content-pages/progress.md`

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
- 创建本 change 时没有实施站点、修改 workflow 或访问 GitHub Pages 设置。
- 尚未运行 TDD、站点 build 或外部部署检查。
- 第一阶段 `docs-demo-site` 已通过 production 浏览器 QA、发布门禁和四包 tarball 边界验证。

## 下一步

- 保持 draft；基于第一阶段实际 page ID、构建和 Demo 契约审查第二阶段范围，用户明确批准后再实施。
