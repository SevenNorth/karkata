# 变更提案：准备 0.1.0 发布与真实集成验证

## 背景

Karkata 的 Core、OpenAI-compatible Provider、可选 JavaScript 工具和 UI 包已经具备首版主要能力，但当前四个 npm 包只有最小清单。`npm pack --workspaces --dry-run` 显示发布物只包含 `dist` 和 `package.json`，缺少许可证与包级使用说明；仓库根 README 也只有英文版本。当前测试主要覆盖源码工作区，尚未验证消费者从实际 tarball 安装后的导入、类型和子路径导出，也没有一个受控的真实 OpenAI-compatible 服务 smoke test。

在面向 C 端应用的轻量 Runtime 定位下，本阶段优先消除首发风险。checkpoint 与外部持久化明确延后，不作为发布前置条件。

## 目标

- 让 `@karkata/core`、`@karkata/openai-compatible`、`@karkata/javascript` 和 `@karkata/ui` 的 `0.1.0` 发布物具备完整、准确且可验证的 npm 元数据。
- 为仓库和每个发布包提供中文与英文 README，示例与当前公共 API 一致。
- 从实际生成的 tarball 创建隔离消费者，验证 ESM 运行时导入、TypeScript 类型和 `@karkata/ui/web-component` 子路径导出。
- 提供显式 opt-in 的真实 OpenAI-compatible smoke test，凭据只从环境变量读取，不进入日志、仓库或默认测试。
- 给出发布前检查清单，但不在本 change 中执行实际 `npm publish`。

## 范围

- 完善根清单和四个包清单中的描述、许可证、仓库、主页、问题地址、关键字、Node 兼容范围和公开 scope 发布配置。
- 新增仓库许可证文件，并确保许可证、双语 README 和构建产物进入各个 tarball。
- 将根 README 调整为中文入口并新增英文版本；四个包分别提供中文和英文的安装、入口、最小示例、安全边界及相关链接。
- 新增可重复的打包消费者 smoke harness，在临时目录中安装本次生成的四个 tarball，执行运行时和类型检查，结束后清理临时产物。
- 新增真实 Provider smoke 脚本及文档，覆盖至少一次非空文本响应；可配置 base URL、API key、model 和 streaming 模式。
- 更新开发/发布命令、设计路线图和发布检查说明。

## 非目标

- 不实现 checkpoint、外部存储或恢复协议。
- 不新增 Provider 原生不透明 compaction item。
- 不修改 Agent 消息、状态、取消、错误或工具协议。
- 不构建生产级代理服务、账户系统或密钥管理服务。
- 不在 CI 或 `npm run check` 中调用真实模型，不保存真实响应正文。
- 不执行登录、scope 授权、版本提升、Git tag、GitHub Release 或 `npm publish`。
- 不承诺所有 OpenAI-compatible 服务都支持相同的流式行为。

## 验收标准

- [x] 根目录与四个发布包均有相互链接的中文、英文 README，所有代码示例通过对应 smoke/typecheck 验证。
- [x] 四个包的清单具有一致且准确的发布元数据，内部依赖版本与首发版本一致。
- [x] `npm pack --workspaces --dry-run` 表明每个 tarball 只包含预期构建产物、清单、许可证和双语 README，不包含源码、测试、密钥或调试文件。
- [x] 隔离消费者能从四个本地 tarball 安装，并成功验证 Core、Provider、JavaScript、UI 主入口和 UI Web Component 子路径的 ESM 导入与 TypeScript 声明。
- [x] 本地确定性假 HTTP 服务验证 Provider 的请求/响应集成，不依赖外部网络。
- [x] 配置有效环境变量时，显式真实 smoke 命令可连接一个 OpenAI-compatible 服务并验证完成结果；缺少配置时给出安全、明确且不含密钥的错误。
- [x] 默认测试、`npm run check`、覆盖率和 workspace dry-run pack 全部通过，默认门禁不会产生真实模型费用。
- [x] 发布检查文档明确 scope 权限、公开访问、版本、2FA/OTP、tag 和回滚边界均需发布者人工确认。

## 风险

- npm scope `@karkata` 的所有权和发布权限无法由代码保证；只能在真正发布前由发布者通过 `npm whoami` 和 scope 权限检查确认。
- 许可证是不可忽略的发布决策；草案建议 MIT，但必须随本方案由用户明确批准。
- 双语文档存在内容漂移风险；采用相同章节结构、交叉链接和文档示例 smoke 检查降低风险。
- tarball 安装验证需要 npm 解析第三方依赖，可能受 registry 或缓存影响；默认 Runtime 行为测试仍保持完全本地确定性。
- 真实服务存在费用、速率限制、协议差异和网络波动，因此只能是显式 opt-in 的人工发布前证据，不能成为稳定 CI 门禁。
- 四个包和文档跨多个区域，规模较大；按“发布物与双语文档”“隔离消费者与真实 smoke”两个阶段实施，并建议拆成两个 Git 提交。

## 待确认项

- 已确认采用 MIT License。
- 已确认根 `README.md` 作为中文默认入口、`README.en.md` 作为英文版本；各包采用相同命名和导航规则。
- 已确认在一个 change 内分两个阶段实施；是否拆成两个 Git 提交仍由用户单独授权。
