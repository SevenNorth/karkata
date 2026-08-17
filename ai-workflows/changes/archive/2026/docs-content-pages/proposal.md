# 变更提案：完善双语文档并部署 GitHub Pages

## 背景

本 change 是双语文档站的第二阶段，依赖 `docs-demo-site` 完成并验收。第一阶段负责 VitePress 双语壳、视觉主题、共享离线 Demo、最小页面和 production build；本阶段补齐面向实际集成的完整指南、类型验证、实际 UI 截图、全站链接门禁，并部署到默认项目地址 `https://sevennorth.github.io/karkata/`。

独立拆分使内容与外部部署权限不阻塞站点基础，也允许在第一阶段真实体验后调整信息架构，而不返工 Runtime 或 Demo 基础。

## 目标

- 补齐 Core、工具、流式回答、Human-in-the-Loop、React、Vue、Web Component 和 OpenAI-compatible 的中英文任务型指南。
- 让所有公开代码示例来自或映射到可执行类型 fixture，避免文档与 API 漂移。
- 使用 production Demo 的真实桌面/移动截图作为视觉资产，并保持交互 Demo 为主要产品证据。
- 建立全站页面配对、内部链接、图片资源、非根 base 和敏感信息检查。
- 通过最小权限 GitHub Actions 部署到 `https://sevennorth.github.io/karkata/`，pull request 只验证不部署。
- 发布后验证中文、英文、搜索、资源和离线 Demo，并将稳定站点入口加入 README。

## 范围

- 在第一阶段页面清单上增加 Core、工具、流式、Human-in-the-Loop、React、Vue、Web Component 和 Provider 页面。
- 为各内容簇建立共享 TypeScript fixture 或可执行示例测试。
- 编写完整中文页面及一一对应的英文页面，保持相同 page ID、章节意图和示例。
- 从 production preview 捕获实际 Demo 的桌面与移动截图，优化尺寸、格式和 alt 文本。
- 扩展 `test:docs`，覆盖全量页面配对、内部链接、静态资源、构建产物和疑似凭据扫描。
- 新增 GitHub Pages build/deploy workflow，使用 `/karkata/` base、最小权限和 concurrency，直接上传 Pages artifact。
- 为 pull request 提供只构建/测试路径，为 `main` 或手动 dispatch 提供部署路径。
- 部署成功后更新根/包 README 的稳定文档入口并执行远端 smoke。

## 非目标

- 不修改第一阶段已验收的 Runtime、UI 或 Demo 公共行为，除非另行 revise。
- 不自动生成完整 TypeDoc API 参考；首版提供稳定导出导航和任务型示例。
- 不连接真实 Provider，不在 Pages 中输入或存储 API Key。
- 不配置自定义域名、DNS、CNAME、分析、反馈平台或第三方搜索服务。
- 不创建 `gh-pages` 分支，不向任何 Git 分支提交或 force-push VitePress 构建产物。
- 不实现版本化文档、多版本切换、博客、营销 CMS 或账户系统。
- 不发布 npm 包、不创建 npm 版本、Git tag 或 GitHub Release。

## 验收标准

- [x] 第一阶段 `docs-demo-site` 已 completed/archived，production build 与离线 Demo 基线通过。
- [x] 页面清单中的所有使用指南都有中英文镜像，语言切换保留当前 page ID。
- [x] Core、工具、流式、Human-in-the-Loop、React、Vue、Web Component 和 Provider 示例通过类型 fixture 或可执行测试。
- [x] 中文与英文页面准确说明会话回滚、流式 partial、HITL 非授权边界、API Key 和 unsafe JavaScript 等关键边界。
- [x] 实际桌面/移动截图清晰展示产品状态，具有准确 alt 文本，不包含虚构数据、密钥或模糊库存画面。
- [x] 全站内部链接、图片、路由、搜索和 `/karkata/` base 构建自动检查通过。
- [x] pull request workflow 不拥有生产部署权限；`main`/手动部署使用最小 Pages 权限和并发保护。
- [x] `website/.vitepress/dist` 保持未跟踪，部署只使用与 workflow run/commit 关联的 Pages artifact。
- [x] `https://sevennorth.github.io/karkata/` 可加载中英文页面、静态资源、搜索和离线 Demo，无资源 404 或外部模型请求。
- [x] 根与包 README 在部署成功后链接到稳定页面，npm tarball 内容仍符合发布白名单。
- [x] `npm run check`、发布测试、package smoke、站点测试、production build 和 workspace dry-run pack 全部通过。

## 风险

- 本阶段依赖 GitHub 仓库 Pages 设置和 Actions 权限；本地代码完成不等于外部部署一定可用。
- 中英文长内容容易漂移；页面 ID 配对只能发现缺页，仍需人工审查语义与示例一致性。
- GitHub Actions 第三方 action 版本和权限是供应链边界；必须固定稳定 major/commit、使用最小权限并避免在 PR 中暴露部署 token。
- 截图会随 UI 变化而过时；只保留少量关键状态，交互 Demo 仍是主要证据。
- 默认 Pages URL 与仓库名绑定；未来自定义域名需要单独 change 调整 base、canonical 和 DNS。

## 待确认项

- 已确认依赖 `docs-demo-site`，第一阶段未验收前不进入 implementing。
- 已确认部署目标为 `https://sevennorth.github.io/karkata/`，base 为 `/karkata/`。
- 已确认 Pages Source 使用 GitHub Actions，不创建 `gh-pages` 分支。
- 已确认视觉资产只使用实际 Demo 截图，不使用库存图或生成式虚构界面。
- 尚未批准本 change 实施；应在第一阶段完成后根据真实站点重新审查内容范围。
