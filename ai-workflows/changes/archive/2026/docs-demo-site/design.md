# 技术设计：建设双语文档与交互演示站点

## 现状分析

- README 已提供双语安装入口；站点应承载更易浏览的任务型内容，避免继续扩大 README。
- `docs/design/` 是实现与评审基线，不直接作为公开站点内容源。
- `examples/ui-demo` 已有响应式页面、确定性 Demo Agent 和安全本地服务器。
- Demo Agent 已模拟累计流式、工具、Human-in-the-Loop、停止、历史和上下文占用，但尚需补齐明确的失败/重试演示。
- Demo app 从 `/packages/ui/dist/web-component.js` 导入，只能在仓库根本地服务器运行。
- 根 workspace 仅包含 `packages/*`；发布 smoke 期望四个 tarball，站点不能成为发布 workspace。

## 方案

### 1. 站点基础

采用 VitePress，站点根为 `website/`。VitePress/Vue 写入根 `devDependencies`，不修改 `workspaces`。根脚本：

- `docs:dev`：构建 `@karkata/ui` 后启动 VitePress。
- `docs:build`：从干净状态构建 UI 和 production 站点。
- `docs:preview`：预览 production build。
- `test:docs`：运行页面配对、base、SSR、组件和静态产物检查。

版本在实施时通过 npm 正常修改 lockfile，并核对 Node 支持和安全公告。

### 2. 双语最小闭环

中文默认 `/`，英文 `/en/`。第一阶段页面清单：

| page ID | 中文 | 英文 |
| --- | --- | --- |
| home | `/` | `/en/` |
| quick-start | `/guide/quick-start` | `/en/guide/quick-start` |
| ui-overview | `/ui/` | `/en/ui/` |
| security | `/guide/security` | `/en/guide/security` |

页面清单是导航和语言切换的唯一映射源。自动测试验证每个 page ID 都有中英文页面，并检查语言切换保持当前 page ID。本地搜索只索引当前 locale 或明确区分语言结果。

### 3. 首页与主题

首页使用文档/工具式布局：Karkata 名称、简短定位、安装命令、开始使用操作和实际 Demo 是第一视口信号，同时露出下一段指南入口。桌面可并列组织安装与 Demo，但不把主体验包进装饰卡片；移动端按任务顺序垂直排列。

主题使用白色/浅灰内容背景、炭灰正文与导航、绿色品牌/主要操作、蓝色链接与信息状态，黄色和红色仅用于警告/错误。圆角不超过 8px，letter-spacing 为 0，不使用渐变、光斑、卡片嵌套或营销式超大标题。

第一阶段不依赖最终截图，交互 Demo 本身承担视觉产品证据。第二阶段再从 production preview 捕获实际桌面/移动截图。

### 4. 唯一 Demo 行为源

优先让 `examples/ui-demo/demo-agent.mjs` 继续作为共享模块；若 VitePress root 限制外部导入，则移动到 `examples/shared/` 并同步更新现有 Demo，仍保持单一文件。不得复制状态机。

以 TDD 扩展明确场景选择，使测试可稳定触发：

- 正常订单流程：流式 -> 工具 -> 提问 -> 回答 -> 完成。
- 流式中停止：保留 UI partial 并由 Store 标记 `incomplete`。
- 可重试失败：产生安全、retryable 的模型错误状态，UI 重试复用原用户消息开始新 run。
- 重置：终止当前运行并创建干净 Demo Agent。

Demo 适配器继续遵守 `AgentUIAdapter` 结构，但它不是第二个 Runtime，也不实现 Provider 或持久化。

### 5. 嵌入组件与 SSR

VitePress Vue 组件只做展示生命周期：

1. `onMounted` 后动态导入并调用 `defineKarkataPanel()`。
2. 创建 Demo Agent，按 locale 设置 `panel.labels`，绑定 Agent 或应用持有的 Store。
3. reset 先 abort 旧运行，再更换 Agent/Store。
4. `onBeforeUnmount` 解除订阅、abort 并 dispose 可用资源。
5. SSR 路径不求值 `window`、`document`、`HTMLElement` 或 Custom Elements Registry。

Demo 显示“本地模拟/Local simulation”，组件代码不调用外部 fetch。production 浏览器验收记录网络请求，除同源页面/资源外不得出现连接。

### 6. Base 与静态产物

配置接受明确 base：本地 `/`，项目 Pages `/karkata/`。Markdown、组件和主题不使用 `/assets`、`/packages` 等根绝对路径。`docs:build` 至少以 `/karkata/` 运行一次，静态检查验证关键路由、脚本、样式和搜索资源存在。

`website/.vitepress/dist` 是可再生构建目录，必须加入 `.gitignore`，不得提交到 `main` 或单独的 `gh-pages` 分支。本阶段不创建 workflow；第二阶段 `docs-content-pages` 消费已验证的 production build，并直接上传 GitHub Pages artifact。

## 影响范围

| 包或区域 | 文件 | 变更 |
| --- | --- | --- |
| workspace | `package.json`、`package-lock.json` | VitePress/Vue 开发依赖与 docs scripts，不改变发布 workspace |
| website | `website/**` | 配置、主题、Demo 组件和 8 个中英文最小页面 |
| UI demo | `examples/ui-demo/**` 或 `examples/shared/**` | 共享 Demo 行为、失败/重试场景及测试 |
| tests | 站点 Node/组件/产物检查 | locale、base、SSR、生命周期和静态构建门禁 |
| readme | 根双语 README | 增加未来站点入口的改动留到实际 URL 可访问后 |

## Runtime 契约

无。站点只消费现有公开 API。若实现需要修改 Core 或 UI 公共契约，必须 revise 回 draft 并重新批准。

## 兼容性与迁移

- 四个发布包的 API、版本、依赖和 tarball 边界保持不变。
- VitePress/Vue 不进入 `@karkata/ui` dependencies。
- `npm run demo:ui` 保持命令和现有成功路径行为。
- 站点不依赖外部网络、Provider、账户或密钥。
- 整个 `website/` 可独立回滚，不影响 Runtime 或 npm 包。

## TDD 与验证方案

- Red 1：页面清单/locale/base 测试因站点配置不存在失败；Green 建立最小 VitePress 双语壳和 production build。
- Red 2：Demo fixture 测试描述失败/incomplete/重试缺口；Green 只扩展共享 fixture。
- Red 3：SSR/挂载测试因组件不存在失败；Green 实现动态注册、labels、reset 和 dispose。
- Red 4：静态产物检查因页面或非根资源缺失失败；Green 补齐最小内容和路径。
- 最终运行 `npm run check`、`npm run test:ui-demo`、`npm run test:release`、`npm run test:package`、`npm run test:docs`、`npm run docs:build` 和 `npm pack --workspaces --dry-run`。
- 使用 production preview 验证 `1280x800`、`390x844`、键盘、reduced-motion、控制台和网络请求。
