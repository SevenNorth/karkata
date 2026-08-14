# 变更提案：增加可运行 UI 演示

## 背景

`@karkata/ui` 已提供 Store 和 Web Component，但仓库没有可直接启动的宿主页面。使用者必须先创建应用和 Agent 才能看到效果，不利于快速验收 UI、Human-in-the-Loop 和响应式布局。

## 目标

- 提供无需 API Key、无需外部网络的可运行浏览器演示。
- 通过一条根命令启动，并输出可点击的本地地址。
- 展示普通消息、工具状态、Human-in-the-Loop 问答、中止和重复运行。

## 范围

- 新增 `examples/ui-demo`，包含静态页面、确定性模拟 Agent 和零依赖本地服务器。
- 新增 `npm run demo:ui` 与聚焦演示测试命令。
- README 增加预览入口和演示边界说明。

## 非目标

- 不调用真实模型、Provider 或业务工具。
- 不修改 `@karkata/core` 或 `@karkata/ui` 公共 API、状态机和发布内容。
- 不引入 Vite、React、Vue、Playwright 或其他运行时依赖。

## 验收标准

- [x] `npm run demo:ui` 构建 UI 包后启动本地服务并输出 URL。
- [x] 页面打开即能看到 `<karkata-panel>`，提交消息后依次展示工具和 Human-in-the-Loop 问题。
- [x] 回答问题后同一运行完成；等待或运行期间点击停止可得到中止状态。
- [x] 模拟 Agent 支持同步状态回放、请求回放、重复会话和有效/失效回答语义。
- [x] 演示不需要密钥或网络，不进入任何发布包。
- [x] 聚焦测试、`npm run check` 和桌面/窄屏真实浏览器检查通过。

## 风险

- 模拟 Agent 只用于演示，不能被误认为 Core 的替代实现；页面和 README 必须明确 demo 边界。
- 静态服务器必须限制读取范围、只绑定 loopback，并正确处理路径穿越和常用 MIME 类型。
- 启动命令是长驻进程，需要正确处理端口占用和 Ctrl+C 退出。

## 待确认项

- 用户已明确要求继续增加可运行演示；无其他待确认项。
