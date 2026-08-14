# 变更提案：建设双语文档与交互演示站点

## 背景

Karkata 已有双语 README 和可离线运行的 `examples/ui-demo`，但首次使用者仍缺少统一、可搜索、可直接体验的文档入口。现有 Demo 依赖仓库根静态服务器和 `/packages/ui/dist` 绝对路径，是开发 fixture，不能直接部署为静态文档站。

整体站点工作已按用户确认拆分。本 change 只交付第一阶段：VitePress 站点基础、双语壳、视觉基线、共享确定性 Demo、嵌入式离线 Demo 和最小内容闭环。完整教程、实际截图和 GitHub Pages 部署由依赖本 change 的 `docs-content-pages` 单独管理。

## 目标

- 建立中文默认 `/`、英文 `/en/` 的 VitePress 静态站点基础。
- 首屏直接提供 Karkata、安装命令、快速开始和实际可操作的离线 Demo，不建设只有营销文案的首页。
- 复用同一个确定性 Demo Agent，使现有本地 Demo 和站点展示相同的流式、Human-in-the-Loop、停止、失败/incomplete、重试和重置语义。
- 建立白色、炭灰、绿色主基线与克制蓝色辅助色的站点主题。
- 建立站点开发、production build、双语页面配对、非根 base、SSR 和浏览器验收基础。

## 范围

- 使用 VitePress，在独立 `website/` 目录建立配置、主题、组件和中英文页面。
- VitePress/Vue 只作为根开发依赖；`website` 不加入 `packages/*` 发布 workspaces。
- 增加 `docs:dev`、`docs:build`、`docs:preview` 和第一阶段 `test:docs` 命令。
- 建立 home、quick-start、UI overview 和 security 四个中英文镜像页面及语言切换、本地搜索和最小导航。
- 抽取或共享 `examples/ui-demo/demo-agent.mjs`，扩展缺失的失败/incomplete/重试场景及测试。
- 实现仅在客户端挂载的 Demo 组件，显式注册 `karkata-panel`，管理 Agent/Store 重置和卸载。
- 支持本地 `/` 与 GitHub 项目页 `/karkata/` 两种 base 构建，不硬编码根静态路径。
- 使用 production preview 完成桌面、移动、键盘、reduced-motion、控制台和无外部网络检查。

## 非目标

- 不编写 Core、工具、流式、Human-in-the-Loop、React、Vue、Web Component 和 Provider 的完整教程；这些属于第二阶段。
- 不生成最终桌面/移动截图资产，不新增 GitHub Pages workflow，不修改仓库 Pages 设置。
- 不提交 `website/.vitepress/dist` 构建产物，也不创建或维护 `gh-pages` 分支。
- 不实现 checkpoint、登录、后端代理或持久化。
- 不连接真实 Provider，不收集或存储 API Key，不引入分析、远程字体或第三方 CDN。
- 不把内部 `docs/design/` 直接发布为公开站点。
- 不修改 Core、Provider、Tool、UI Store 或 Web Component 公共契约。
- 不自动创建 commit、push 或部署。

## 验收标准

- [x] `npm run docs:dev` 可启动站点，`npm run docs:build` 可从干净状态生成静态产物。
- [x] 中文 `/` 和英文 `/en/` 具有镜像首页、快速开始、UI 概览和安全页面，并能切换到对应页面而不是总跳回首页。
- [x] 首页首屏显示 Karkata、字面定位、安装命令与可交互离线 Demo，并保留下一区域入口提示。
- [x] Demo 覆盖流式、工具、Human-in-the-Loop、停止后 incomplete、可重试失败、重试和重置，且不发出外部网络请求。
- [x] `npm run demo:ui` 保持可用；两个入口复用同一 Demo 行为源，没有复制状态机。
- [x] SSR build 阶段不访问 DOM，组件卸载后不残留订阅、timer 或活动运行。
- [x] 非根 base `/karkata/` 构建下页面、搜索、资源和 Demo 均可加载。
- [x] `1280x800` 与 `390x844` 无横向溢出、文本截断、导航遮挡或消息/输入重叠；键盘与 reduced-motion 行为正确。
- [x] 主题遵循已确认视觉基线，不使用渐变球、大面积营销 Hero、无关库存图或卡片嵌套。
- [x] `npm run check`、`npm run test:ui-demo`、`npm run test:docs`、`npm run docs:build`、`npm run test:package` 和 workspace dry-run pack 全部通过。

## 风险

- VitePress 使用 Vue，但它只能是站点开发依赖；tarball 验证必须证明它不进入四个发布包。
- 现有 Demo 使用根绝对路径；共享行为时必须保持本地 Demo 兼容，并让站点通过构建器解析资源。
- Web Component 在 SSR 中不能读取 DOM；必须动态挂载且测试销毁路径。
- Demo fixture 新增失败/重试属于示例行为变化，仍需 Red-Green 测试，不能复制 Core 状态机。
- GitHub Pages `/karkata/` 只在本阶段验证构建兼容，真正部署权限和 workflow 留到第二阶段。

## 待确认项

- 已确认拆分为两个 change；本 change 是第一阶段，`docs-content-pages` 是第二阶段。
- 已确认使用 VitePress，Vue/VitePress 仅作为根开发依赖。
- 已确认未来首版部署目标为默认 GitHub Pages 地址 `https://sevennorth.github.io/karkata/`，base 为 `/karkata/`。
- 已确认 Pages Source 使用 GitHub Actions；构建产物上传为 Pages artifact，不进入 Git 分支。
- 已确认沿用现有 Demo 的白色、炭灰、绿色视觉基线，并使用克制蓝色作为辅助色。
- 用户已明确批准第一阶段实施，change 已按流程进入 implementing。
