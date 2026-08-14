# 实施任务：完善双语文档并部署 GitHub Pages

## 任务

- [ ] 1. 恢复并验证依赖：确认 `docs-demo-site` 已 completed/archived，重新核对 page ID、base、主题和 Demo production 基线。
- [ ] 2. Red：新增 Core/Tools、Streaming/HITL、React/Vue、Web Component/Provider 示例 fixture，记录缺失或错误用法。
- [ ] 3. Green：完成严格类型 fixture，使所有公开示例模式通过且不修改 Runtime 契约。
- [ ] 4. 编写 Core、工具、流式、HITL、React、Vue、Web Component、Provider 和 API 导航中文页面。
- [ ] 5. 完成相同 page ID 的英文页面，审查标题层级、示例和安全边界语义一致。
- [ ] 6. Red/Green：建立全站页面配对、frontmatter、内部链接、截图资源和疑似凭据检查，补齐实际桌面/移动 Demo 截图。
- [ ] 7. Red/Green：建立 workflow 权限/base/artifact 静态检查，新增无 `gh-pages` 分支 push 的 GitHub Pages 验证与最小权限部署流程。
- [ ] 8. 执行完整本地门禁和 production preview QA；有权限的发布者启用 Pages 并部署到默认项目地址。
- [ ] 9. 完成部署后中英文、深层路由、搜索、资源、Demo、控制台和网络 smoke，验证成功后更新根/包 README 链接。

## TDD 记录

| 行为 | Red 命令与失败摘要 | Green 命令与结果 | Refactor 后结果 |
| --- | --- | --- | --- |
| 文档示例类型 | 尚未运行 | 尚未运行 | 尚未运行 |
| 页面/链接/资源 | 尚未运行 | 尚未运行 | 尚未运行 |
| workflow 权限/base/artifact | 尚未运行 | 尚未运行 | 尚未运行 |
| 部署后 smoke | 尚未运行 | 尚未运行 | 尚未运行 |

## 验证记录

| 检查 | 结果 | 备注 |
| --- | --- | --- |
| 第一阶段依赖 | 未满足 | `docs-demo-site` 当前仍为 draft |
| `npm run check` | 未运行 | 实施后运行 |
| `npm run test:docs` | 未运行 | 全站检查 |
| `npm run docs:build` | 未运行 | `/karkata/` production build |
| `npm run test:release` | 未运行 | 发布元数据回归 |
| `npm run test:package` | 未运行 | tarball 消费者回归 |
| workspace dry-run pack | 未运行 | 仍只允许四个包 |
| production/deployed browser QA | 未运行 | 桌面/移动、双语、搜索、Demo 与网络 |

## 实施备注

- 本 change 是已确认拆分的第二阶段，依赖 `docs-demo-site`。
- 第一阶段完成前保持 draft，不进入 implementing。
- Pages 设置、部署和 README 远端链接需要外部状态成功；本地 build 通过不能替代部署后 smoke。
- 当前仅记录规划，未创建 workflow、页面、截图、提交或部署。
