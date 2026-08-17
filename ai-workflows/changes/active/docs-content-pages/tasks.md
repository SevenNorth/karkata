# 实施任务：完善双语文档并部署 GitHub Pages

## 任务

- [x] 1. 恢复并验证依赖：确认 `docs-demo-site` 已 completed/archived，重新核对 page ID、base、主题和 Demo production 基线。
- [x] 2. Red：新增 Core/Tools、Streaming/HITL、React/Vue、Web Component/Provider 示例 fixture，记录缺失或错误用法。
- [x] 3. Green：完成严格类型 fixture，使所有公开示例模式通过且不修改 Runtime 契约。
- [x] 4. 编写 Core、工具、流式、HITL、React、Vue、Web Component、Provider 和 API 导航中文页面。
- [x] 5. 完成相同 page ID 的英文页面，审查标题层级、示例和安全边界语义一致。
- [x] 6. Red/Green：建立全站页面配对、frontmatter、内部链接、截图资源和疑似凭据检查，补齐实际桌面/移动 Demo 截图。
- [x] 7. Red/Green：建立 workflow 权限/base/artifact 静态检查，新增无 `gh-pages` 分支 push 的 GitHub Pages 验证与最小权限部署流程。
- [ ] 8. 执行完整本地门禁和 production preview QA；有权限的发布者启用 Pages 并部署到默认项目地址。
- [ ] 9. 完成部署后中英文、深层路由、搜索、资源、Demo、控制台和网络 smoke，验证成功后更新根/包 README 链接。

## TDD 记录

| 行为 | Red 命令与失败摘要 | Green 命令与结果 | Refactor 后结果 |
| --- | --- | --- | --- |
| 文档示例类型 | `node --test scripts/docs/example-fixtures.test.mjs`：`toolName`、`state.partial`、`store.snapshot`、Provider `apiUrl` 与公开类型不匹配；React 类型缺失 | 同命令：4 个内容簇严格类型检查通过 | `npm run test:docs`：持续通过 |
| 页面/链接/资源 | `node --test scripts/docs/site-contract.test.mjs`：缺少 `validateSiteContent` 导出 | `npm run test:docs`：10 项通过、13 组页面有效；`npm run docs:build`：26 个 `/karkata/` production 路由有效 | `npm run test:docs:browser`：26 路由、搜索、截图、桌面/移动与网络检查通过 |
| workflow 权限/base/artifact | `node --test scripts/docs/pages-workflow.test.mjs`：缺少 `.github/workflows/docs-pages.yml` | 同命令：2 项结构化 YAML 权限与 artifact 检查通过 | `npm run test:docs`：持续通过 |
| 部署后 smoke | 尚未运行 | 尚未运行 | 稳定 URL 与公开 Pages API 当前均返回 404，等待启用和 workflow 部署 |

## 验证记录

| 检查 | 结果 | 备注 |
| --- | --- | --- |
| 第一阶段依赖 | 通过 | `docs-demo-site` 已 archived；4 组双语 page ID、`/karkata/` base、共享 Demo 与 production browser smoke 基线已核对 |
| `npm run check` | 通过 | 6 个测试文件、182 项测试通过；类型检查及四包 build 通过 |
| `npm run test:docs` | 通过 | 12 项测试及 13 组双语页面通过 |
| `npm run docs:build` | 通过 | `/karkata/` 下 26 个 production 路由有效 |
| `npm run test:release` | 通过 | 7 项发布契约测试通过 |
| `npm run test:package` | 通过 | 4 个 tarball 构建、安装与 smoke 通过 |
| workspace dry-run pack | 通过 | 仅生成四个发布包 |
| production/deployed browser QA | 本地通过，远端待部署 | 26 路由、搜索、桌面/移动、Demo、控制台和同源网络通过；远端当前 404 |

## 实施备注

- 本 change 是已确认拆分的第二阶段，依赖 `docs-demo-site`。
- 用户已于 2026-08-17 明确批准；change 已进入 implementing。
- Pages 设置、部署和 README 远端链接需要外部状态成功；本地 build 通过不能替代部署后 smoke。
- 已完成本地实现与验证；未创建提交、推送或远端部署。
