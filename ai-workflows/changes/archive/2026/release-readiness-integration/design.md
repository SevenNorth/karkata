# 技术设计：准备 0.1.0 发布与真实集成验证

## 现状分析

- 根 `package.json` 声明四个 workspaces 和 Node `>=22.18.0` 的开发环境，但发布包没有 `engines`、description、license、repository、homepage、bugs、keywords 或 `publishConfig`。
- 四个包使用 ESM、`exports`、`main` 和 `types`，`@karkata/ui` 另有 `./web-component` 子路径。内部依赖固定为 `0.1.0`。
- 当前各包的 `files` 仅为 `dist`。dry-run tarball 不包含 README 或 LICENSE，包大小与文件列表本身正常。
- 根 README 是英文且同时承担架构概览、完整示例、UI 和开发说明；没有包级 README。
- `examples/ui-demo` 是离线确定性 UI 演示，不应被改造成持有真实 API Key 的浏览器示例。
- Provider 已有本地假响应的单元测试，但没有从发布 tarball 安装后的消费者验证，也没有真实服务的显式 smoke 入口。

## 方案

### 1. 发布清单与许可证

根清单作为元数据基线。四个包增加与自身用途匹配的 description/keywords，统一使用 MIT、GitHub repository、homepage、bugs、`engines.node` 和 `publishConfig.access: public`。包级 `repository.directory` 指向对应 workspace。

许可证在仓库根保存一份，并在打包脚本准备 tarball 时以相同文本进入每个包发布物。是否直接在每个包目录保留 `LICENSE`，以 dry-run 结果和维护成本为准；验收要求是 tarball 内确实存在许可证且内容一致。

不改变 `0.1.0`，不加入发布钩子自动执行 publish，不读取或写入 npm token。

### 2. 双语文档

采用中文默认、英文并列：

- 根：`README.md`（中文）与 `README.en.md`（英文）。
- 包：`packages/<name>/README.md`（中文）与 `README.en.md`（英文）。
- 每份文档顶部提供绝对 GitHub 链接切换语言，保证在 npm 页面和 GitHub 中都可用。

根 README 讲整体定位、包选择、端到端快速开始、UI、安全和开发。包 README 只讲该包的安装、公开入口、最小示例、环境/安全边界和相关包，避免简单复制整份根文档。中英文保持相同章节和示例源；可执行示例进入 smoke fixture，README 引用经过验证的同一用法。

### 3. 发布 tarball 消费者验证

新增仓库脚本完成以下步骤：

1. 在系统临时目录创建唯一工作目录。
2. 先执行 workspace build，再把四个包 pack 到临时目录。
3. 生成最小 ESM + TypeScript 消费者项目，同时安装四个本地 tarball。
4. 运行 TypeScript `--noEmit`，验证公开类型、`createAgent()`、`createUnsafeJavaScriptTool()`、`createAgentUIStore()` 和 Web Component 子路径。
5. 运行 Node smoke，验证主入口加载和一个使用本地确定性 HTTP 服务的 OpenAI-compatible 调用。
6. 检查 tarball 文件白名单、许可证、双语 README 和敏感文件黑名单。
7. 在成功或失败后清理临时目录，不在仓库生成 `.tgz`。

脚本使用参数数组启动子进程，避免拼接 shell 命令；临时目录和清理目标必须由脚本创建并验证。第三方依赖安装失败应报告为环境/registry 问题，不伪装成 Runtime 行为失败。

### 4. 真实 Provider smoke

新增独立命令，例如 `npm run test:integration:real`。脚本只读取：

- `KARKATA_BASE_URL`
- `KARKATA_API_KEY`
- `KARKATA_MODEL`
- 可选 `KARKATA_STREAMING`

缺少必填项时立即失败并打印变量名，不打印值。脚本发送低成本、无敏感业务数据的固定提示，断言结果为 completed 且最后一条 Assistant 文本非空；输出只包含服务地址的安全来源说明、模式、耗时和通过/失败，不输出 Authorization、完整请求或响应正文。

真实 smoke 不进入 `npm run check`、默认 Vitest 或 CI。发布者在自己的受控环境显式运行并记录 Provider、模型和日期。流式模式是可选兼容验证，不把不支持流式的服务判定为整个包不可发布。

### 5. 发布清单

新增发布文档，顺序覆盖：clean status、版本一致性、完整门禁、coverage、tarball 消费者、pack 内容、真实 smoke（若有目标 Provider）、npm 身份/scope/2FA、dry-run、人工 publish/tag/release。自动化止于可逆的验证；真正发布保持人工显式动作。

## 影响范围

| 包或区域 | 文件 | 变更 |
| --- | --- | --- |
| workspace | `package.json`、新增 release smoke 脚本/fixture | 新增发布验证命令和隔离消费者 harness |
| repository | `LICENSE`、`README.md`、`README.en.md` | 许可证与双语总览 |
| core | `packages/core/package.json`、双语 README | 发布元数据和 Core 使用说明 |
| openai-compatible | `packages/openai-compatible/package.json`、双语 README | 发布元数据、Provider 配置与安全说明 |
| javascript | `packages/javascript/package.json`、双语 README | 发布元数据与 unsafe 边界说明 |
| ui | `packages/ui/package.json`、双语 README | 主入口/Web Component 子路径和框架集成说明 |
| examples/tests | 新增本地 package smoke 与真实 Provider smoke | 验证 tarball、类型、导入和真实连接 |
| docs | 发布检查文档、`docs/design/Karkata无头智能体运行时设计.md` | 记录 checkpoint 暂缓与发布阶段 |

## Runtime 契约

无消息、工具、状态、错误、取消、超时或配置契约变化。真实 smoke 只消费现有公共 API，不新增包导出。包清单的 Node engines 和发布文件集合属于发布契约，需由 tarball 消费者测试覆盖。

## 兼容性与迁移

- 保持 ESM-only、现有包名、导出路径和版本 `0.1.0`。
- `@karkata/ui/web-component` 继续是显式浏览器入口；Node smoke 只验证该子路径的类型解析，不在无 DOM 环境执行注册。
- 发布包的 Node 下限应基于 ES2022 输出、使用 API 和实际 smoke 结果确定；开发工具继续可以要求 Node `>=22.18.0`。实施时不得未经证据把根开发 engines 直接复制为消费者下限。
- 新增清单字段和文档不要求存量代码迁移。若 tarball smoke 暴露缺失导出或类型错误，任何公共 API 修订都必须回到 draft 重新确认范围。
- 回滚可以按两个阶段分别撤销；实际 npm 发布不在本次自动化范围内。

## TDD 与验证方案

- Red 1：为发布清单和 tarball 白/黑名单新增测试，预期因元数据、LICENSE 和 README 缺失失败；Green 后四包均通过。
- Red 2：新增隔离消费者类型与运行 smoke，预期因 harness/包文档缺失或当前发布物不可完整消费失败；Green 后从真实 tarball 安装并验证全部公开入口。
- Red 3：为真实 smoke 的配置解析、密钥脱敏、完成结果校验写本地单元测试，预期因脚本不存在失败；Green 后本地假 Provider 覆盖成功、缺参和失败路径。
- 文档翻译本身不伪造 Red，但其代码示例必须被类型或 smoke fixture 覆盖。
- 受影响验证：聚焦脚本测试、`npm run check`、`npm run test:coverage`、tarball consumer smoke、`npm pack --workspaces --dry-run`。
- 真实 Provider smoke 只在用户提供受控环境变量时运行；未提供凭据不阻塞代码级验收，但发布清单必须明确记录“未运行”。
