# 实施进度：增加可运行 UI 演示

## 当前状态

- 当前任务：全部完成，等待归档
- TDD 阶段：Completed
- 最后完成：任务 5，全量门禁与真实浏览器检查
- 阻塞项：无

## 已修改文件

- `ai-workflows/changes/active/ui-demo/*`
- `examples/ui-demo/demo-agent.mjs`
- `examples/ui-demo/demo-agent.test.mjs`
- `examples/ui-demo/server.mjs`
- `examples/ui-demo/server.test.mjs`
- `examples/ui-demo/index.html`
- `examples/ui-demo/app.mjs`
- `package.json`
- `README.md`

## 关键决策

- 演示使用确定性模拟 Agent，不需要真实 Provider、网络或 API Key。
- 页面绑定真实 `@karkata/ui` Web Component，不复制生产组件结构。
- 静态服务器只使用 Node 标准库并绑定 loopback。
- 示例不进入 npm 发布包，不修改 Runtime 或 UI 公共契约。

## 验证记录

- 模拟 Agent Red：测试因 `demo-agent.mjs` 不存在而加载失败。
- 模拟 Agent Green：Node test runner 3 项通过。
- 静态服务器 Red：测试因 `server.mjs` 不存在而加载失败。
- 静态服务器 Green：Node test runner 2 项通过。
- `npm run test:ui-demo`：2 个 suite、6 项测试通过。
- 浏览器回归 Red：self-only CSP 阻止内联 module，组件未注册。
- 浏览器回归 Green：启动逻辑移至 `app.mjs`；服务器测试增至 3 项通过。
- Edge 自动化：1280x800 完成消息、工具、提问、回答和完成流程；390x844 等待问题状态无横向滚动，全部输入控件位于视口内。
- `npm run check`：6 个测试文件、151 项通过，四个 workspace 类型检查和构建通过。
- `npm pack --workspaces --dry-run`：四个包通过，示例未进入发布清单。

## 下一步

- 校验 change，流转 completed 并归档；保持演示服务运行供用户访问。
