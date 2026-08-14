# 实施任务：建设双语文档与交互演示站点

## 任务

- [x] 1. Red：新增第一阶段页面清单、locale 路由和非根 base 测试，记录站点配置缺失。
- [x] 2. Green：安装仅限根开发环境的 VitePress/Vue，建立 `website/`、双语壳和 docs scripts，使最小 production build 通过。
- [x] 3. 建立已确认的白色/炭灰/绿色加蓝色辅助主题、文档首页布局、导航、语言切换、本地搜索和响应式尺寸约束。
- [x] 4. Red：扩展共享 Demo fixture 测试，覆盖可重试失败、流式中止后 incomplete、重试与重置。
- [x] 5. Green：重构/扩展唯一 Demo Agent 行为源，并保持 `npm run demo:ui` 既有测试通过。
- [x] 6. Red：新增嵌入组件 SSR、客户端挂载、locale labels、重置和卸载测试。
- [x] 7. Green：实现可打包的离线 Demo 组件与中英文 home/quick-start/UI/security 页面，不访问外部网络。
- [x] 8. Refactor/验证：统一页面清单、主题 token 和 Demo 生命周期，执行完整门禁与 production 桌面/移动浏览器验收。

## TDD 记录

| 行为 | Red 命令与失败摘要 | Green 命令与结果 | Refactor 后结果 |
| --- | --- | --- | --- |
| locale/page/base | `node --test scripts/docs/site-contract.test.mjs`：缺少 `website/page-manifest.mjs` | 同命令：3 项通过 | `npm run test:docs`：页面配对与 base 契约持续通过 |
| 共享 Demo 失败/重试与本地化 | `node --test examples/ui-demo/demo-agent.test.mjs`：错误恢复场景被忽略并保持 pending；中文 seed 仍为英文 | 同命令：失败/重试 4 项通过，加入本地化后 5 项通过 | `npm run test:ui-demo`：8 项通过，现有 server 行为保持兼容 |
| Demo SSR 与生命周期 | `node --test scripts/docs/demo-controller.test.mjs`：缺少 `demo-controller.mjs` | 同命令：注册、替换、dispose 和迟到模块隔离 2 项通过 | `npm run test:docs`：生命周期契约持续通过，SSR build 通过 |
| 静态产物 | `node --test scripts/docs/static-output.test.mjs`：缺少 `static-output.mjs` | 同命令：有效产物与拒绝异常产物 2 项通过 | `npm run test:docs:browser`：8 路由及 `/karkata/` 资源通过 production smoke |

## 验证记录

| 检查 | 结果 | 备注 |
| --- | --- | --- |
| `npm run check` | 通过 | 6 个测试文件、182 项测试通过；类型检查及四个 workspace build 通过 |
| `npm run test:ui-demo` | 通过 | Demo Agent 5 项、server 3 项通过 |
| `npm run test:docs` | 通过 | 7 项测试及 4 组双语页面配对通过 |
| `npm run docs:build` | 通过 | VitePress SSR/client build 成功，`/karkata/` 下 8 个静态路由有效 |
| `npm run test:release` | 通过 | 7 项发布契约测试通过 |
| `npm run test:coverage` | 通过 | statements 90.52%，lines 94.45% |
| `npm run test:package` | 通过 | 4 个 tarball 构建、安装与 smoke 通过 |
| `npm pack --workspaces --dry-run` | 通过 | 仅生成四个发布包，站点依赖未进入 tarball |
| production browser QA | 通过 | `1280x800`、`390x844`、中英文、停止/incomplete、重试、HITL、reduced-motion、控制台和网络检查通过 |

## 实施备注

- 已按用户确认拆分；本 change 只包含第一阶段 8 项任务。
- 第二阶段记录在 `docs-content-pages`，依赖本 change 完成。
- 用户已批准并完成第一阶段实施；未创建提交、推送或部署。
