# 技术设计：完善双语文档并部署 GitHub Pages

## 现状分析

- 本 change 依赖 `docs-demo-site`，不重复定义 VitePress、locale、主题、Demo Agent 或组件生命周期。
- 仓库 README 和包 README 已有双语摘要，详细站点应成为任务型内容的主要来源。
- 发布验证已具备 `test:release`、`test:package` 和 workspace dry-run pack，可用于证明站点依赖与内容不会污染 npm 包。
- GitHub remote 为 `SevenNorth/karkata`，默认项目 Pages URL 为 `https://sevennorth.github.io/karkata/`；仓库 Pages 设置和 Actions 权限仍需实施时确认。

## 方案

### 1. 内容清单

在第一阶段的 home、quick-start、UI overview 和 security 上增加：

| page ID | 中文 | 英文 | 主要结果 |
| --- | --- | --- | --- |
| core | `/guide/core` | `/en/guide/core` | 创建 Agent、会话和状态 |
| tools | `/guide/tools` | `/en/guide/tools` | Schema、ToolOutput、取消和安全 |
| streaming | `/guide/streaming` | `/en/guide/streaming` | partial 与最终消息 |
| human-input | `/guide/human-input` | `/en/guide/human-input` | ask_user、respond 与授权边界 |
| react | `/ui/react` | `/en/ui/react` | `useSyncExternalStore` 集成 |
| vue | `/ui/vue` | `/en/ui/vue` | `shallowRef` 与生命周期 |
| web-component | `/ui/web-component` | `/en/ui/web-component` | 注册、labels、theme 与 Store 所有权 |
| openai-compatible | `/provider/openai-compatible` | `/en/provider/openai-compatible` | baseURL、凭据、错误与流式兼容 |

API 导航页面只列稳定包入口、关键类型和对应指南，不解析源码生成完整 API 文档。内部 `docs/design/` 可作为贡献者链接，但不混入使用者侧栏。

### 2. 示例单一来源

新增站点示例 fixtures，按内容簇验证：

- Core/Tools：严格 TypeScript、Zod schema、AbortSignal 和可见 ToolOutput。
- Streaming/HITL：类型与状态判别，不伪造 Runtime 行为。
- React：使用 React 类型验证 `useSyncExternalStore` 适配模式；若不希望新增 React 运行依赖，可使用仅类型 devDependency 或独立 fixture 安装策略。
- Vue：复用站点 Vue 依赖验证 `shallowRef`/`onUnmounted`。
- Web Component：验证主入口 DOM-free 与浏览器子路径类型。
- Provider：验证 `createAgent()` 配置和服务端代理安全示例。

Markdown 代码块应引用相同 fixture 片段或由结构检查保证同步；不得维护含关键语义差异的第三份示例。

### 3. 双语编辑规则

中文先定义技术事实和任务流程，英文在同一任务中完成。两种语言保持：

- 相同 page ID、标题层级意图和示例代码。
- 相同警告、安全边界和版本说明。
- 自然语言可本地化，不逐句机械翻译。

页面 frontmatter 包含稳定 title/description。canonical、alternate locale 和 sitemap 使用 `/karkata/` base 生成，避免重复或根路径错误。

### 4. 实际截图

从第一阶段 production preview 捕获实际 UI：

- 桌面：正常流式/HITL 关键状态。
- 移动：消息和输入布局。
- 可选第三张：停止后 incomplete 或可重试错误。

截图使用确定性 fixture 数据，裁切保留真实产品状态，不含浏览器个人信息。保存为适合 Web 的 PNG/WebP，提供固有尺寸、响应式约束和准确 alt 文本。构建检查验证资源存在，浏览器 QA 验证清晰度和主题一致性。

### 5. GitHub Pages workflow

仓库 Pages Source 选择 **GitHub Actions**，不使用 “Deploy from a branch”。VitePress 输出目录保持在 `.gitignore` 中；workflow 使用 GitHub 官方 Pages actions 直接上传 artifact，不向 `main`、`gh-pages` 或其他分支 push 构建文件。workflow 分离验证与部署条件：

- pull request/push 均可执行 install、check、docs test 和 docs build。
- 只有 `main` 的明确事件或 `workflow_dispatch` 执行 `configure-pages`、artifact upload 和 deploy。
- build job 默认 `contents: read`；deploy job 只增加 `pages: write`、`id-token: write`。
- deployment environment 使用 `github-pages`，配置 concurrency 防止旧部署覆盖新部署。
- npm 使用 lockfile 与 `npm ci`，不注入模型或 npm 发布凭据。
- Pages artifact 与源 commit/workflow run 关联；不通过机器人 token 或 force-push 维护生成分支。

构建环境设置 base `/karkata/`。若 GitHub Pages 设置尚未启用，workflow 应清晰失败，不通过扩大权限或写入 token 绕过。

### 6. 部署后 smoke

部署后读取稳定 URL，至少验证：

- `/karkata/` 与 `/karkata/en/` 返回 200。
- 关键 JS/CSS、搜索索引和截图不返回 404。
- 语言切换与一个深层指南路由可达。
- Demo 加载、发送、停止/重置可用，控制台无异常。
- 网络请求仅指向同源 Pages 静态资源，不调用模型 Provider。

远端 smoke 不包含破坏性动作或密钥。GitHub Pages 外部状态失败应与代码 build 失败区分记录。

## 影响范围

| 包或区域 | 文件 | 变更 |
| --- | --- | --- |
| website content | `website/**/*.md` | 完整中英文任务型指南和 API 导航 |
| examples/tests | 站点类型 fixtures | 验证 Core、工具、UI 框架与 Provider 示例 |
| assets | `website/public/images/**` | 实际桌面/移动 Demo 截图 |
| docs checks | 站点清单、链接和资源脚本 | 全站结构与敏感信息门禁 |
| deployment | `.github/workflows/**`、`.gitignore` | Pages artifact build/deploy、生成目录忽略与最小权限 |
| readme | 根/包双语 README | 部署成功后增加稳定站点链接 |

## Runtime 契约

无。若内容实施暴露公共 API 缺口，只记录问题并另开/修订对应 Runtime change，不在文档 change 中顺带修改契约。

## 兼容性与迁移

- 依赖第一阶段页面 ID 和 `/karkata/` base；如果第一阶段改变这些契约，本 change 必须同步 revise。
- npm 包、Runtime 和本地 Demo 不因部署失败而受影响。
- README 只在实际 Pages URL 验证成功后添加链接，避免发布死链。
- 未来自定义域名通过独立 change 迁移 canonical/base/CNAME，不在本阶段预留模糊双路径。

## TDD 与验证方案

- Red 1：示例 fixture 对缺失/错误用法失败；Green 完成每个内容簇的严格类型验证。
- 内容中英文按 page ID 成对落地；配对、frontmatter 和语言切换检查持续 Green。
- Red 2：全站链接/资源检查发现尚未存在页面和截图；Green 补齐内容、截图和引用。
- Red 3：workflow 静态检查要求 PR 无部署权限、deploy 最小权限、`/karkata/` base、artifact 部署且无分支 push；Green 新增 Pages workflow。
- 最终运行 Runtime/发布/站点完整门禁与 production preview 浏览器 QA。
- 用户或有权限的发布者启用 Pages 后执行部署，记录 URL、commit、workflow run 和部署后 smoke。
