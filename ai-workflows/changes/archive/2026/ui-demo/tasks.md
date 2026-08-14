# 实施任务：增加可运行 UI 演示

## 任务

- [x] 1. Red/Green：测试并实现模拟 Agent 的同步回放、问答、失效回答、中止和连续运行。
- [x] 2. Red/Green：测试并实现 loopback 静态服务器的正常响应及安全边界。
- [x] 3. 创建实际演示页面，绑定 Web Component 并提供响应式宿主样式。
- [x] 4. 增加根命令和 README 预览说明，核对发布包不包含演示。
- [x] 5. 运行聚焦测试、workspace 门禁、打包预检及桌面/窄屏浏览器交互检查。

## TDD 记录

| 行为 | Red 命令与失败摘要 | Green 命令与结果 | Refactor 后结果 |
| --- | --- | --- | --- |
| 模拟 Agent | `node --test examples/ui-demo/demo-agent.test.mjs`：模块不存在，suite 加载失败 | 同命令：3 项通过 | 3 项通过 |
| 静态服务器 | `node --test examples/ui-demo/server.test.mjs`：模块不存在，suite 加载失败 | 同命令：2 项通过 | CSP 回归先失败后修复，共 3 项通过 |

## 验证记录

| 检查 | 结果 | 备注 |
| --- | --- | --- |
| `npm run test:ui-demo` | 通过 | 2 个 suite、6 项测试通过 |
| `npm run check` | 通过 | 6 个测试文件、151 项测试，四个 workspace 构建通过 |
| `npm pack --workspaces --dry-run` | 通过 | 四个正式包通过；演示未进入任何发布清单 |
| 桌面/窄屏真实浏览器 | 通过 | Edge 1280x800 与 390x844；完整消息到回答流程和布局边界通过 |

## 实施备注

真实浏览器首次检查发现 self-only CSP 拦截内联 module。增加回归测试并将启动逻辑移至同源 `app.mjs`，未放宽 CSP。浏览器自动化临时使用 npm 缓存中的 Playwright 驱动本机 Edge，未增加依赖或 lockfile。
