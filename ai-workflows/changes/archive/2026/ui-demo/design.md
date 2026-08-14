# 技术设计：增加可运行 UI 演示

## 现状分析

`@karkata/ui/web-component` 要求宿主显式注册元素并绑定真实 Agent 或外部 Store。包使用 `files: ["dist"]` 发布，因此仓库外的 `examples/` 不会进入 npm 包。项目未安装前端开发服务器，Node 22 已是明确的最低运行环境，可以用标准库提供只读静态服务。

## 方案

在 `examples/ui-demo` 增加三个部分：

1. `demo-agent.mjs` 实现 `AgentUIAdapter` 所需的最小结构接口。它同步回放当前状态，使用确定性计时依次发布用户消息、普通 Assistant 消息、工具调用/结果和 `ask_user` 请求。`respond()` 只接受当前 request ID 一次，`abort()` 清理计时器并以 aborted 结果收敛。
2. `index.html` 注册真实 `<karkata-panel>` 并设置 `panel.agent = demoAgent`。页面只承担宿主布局和少量主题变量，不复制组件内部 UI。
3. `server.mjs` 只绑定 `127.0.0.1`，从仓库根目录提供 GET/HEAD 静态文件。路径先 decode、resolve 并校验仍位于仓库根内；目录、缺失文件和非 GET/HEAD 返回明确状态。

根命令先构建 UI，再启动服务器。端口默认 `4173`，可通过 `PORT` 覆盖。演示测试使用 Node 内置 test runner 和短延迟配置验证模拟 Agent，无新增依赖。

## 影响范围

| 包或区域 | 文件 | 变更 |
| --- | --- | --- |
| 演示 | `examples/ui-demo/*` | 页面、模拟 Agent、服务器和测试 |
| workspace | `package.json` | `demo:ui` 与 `test:ui-demo` 命令 |
| 文档 | `README.md` | 本地预览步骤及非生产边界 |
| change | `ai-workflows/changes/active/ui-demo/*` | 审批、TDD 与验证记录 |

## Runtime 契约

无变化。模拟 Agent 仅消费 `AgentUIAdapter` 结构契约，不从任何稳定包入口导出，也不改变 Core 消息、状态、请求、取消或会话行为。

## 兼容性与迁移

示例依赖仓库要求的 Node 22 和现代浏览器 ESM/Custom Elements。现有包发布清单不变，`examples/` 不属于任何 workspace 包的 `files`。删除示例目录、根脚本和 README 段落即可完整回滚。

## TDD 与验证方案

1. Red：先写模拟 Agent 的 Node 测试，因模块不存在失败。
2. Green：实现同步回放、消息到问答再完成、失效回答、中止和连续运行。
3. 为服务器增加启动与 HTTP smoke test，验证页面、模块、HEAD、404、方法限制和路径边界。
4. 运行 `npm run test:ui-demo`、`npm run check` 和 `npm pack --workspaces --dry-run`，确认演示不进入发布包。
5. 启动 `npm run demo:ui`，用真实浏览器完成桌面与窄屏交互和截图检查。
