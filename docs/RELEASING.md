# Karkata 发布检查

本文档描述 `0.1.x` npm 发布前验证。验证脚本只执行可逆检查，不会登录 npm、修改版本、创建 Git tag 或发布包。

## 1. 本地基线

- 确认 Node.js `>=22.18.0`、npm `>=11`，并使用干净工作区。
- 从 lockfile 安装依赖：`npm ci`。
- 检查四个 workspace 的版本和内部依赖版本一致。

```bash
git status --short
npm pkg get version --workspaces
npm run check
npm run test:release
npm run test:coverage
npm run test:package
npm pack --workspaces --dry-run
```

`npm run test:package` 会在系统临时目录构建并生成四个真实 tarball，然后创建隔离消费者进行安装、TypeScript 类型检查、ESM 导入、本地假 Provider 调用和 UI 子路径检查。脚本结束后会删除临时目录，不在仓库保留 `.tgz`。

人工检查 dry-run 文件列表。每个包只应包含：

- `package.json`
- `LICENSE`
- `README.md`
- `README.en.md`
- `dist/**`

不得出现 `src`、测试、`.env`、token、日志、coverage、tsbuildinfo 或其他调试产物。

## 2. 真实 Provider 验证

真实 smoke 是显式 opt-in，不属于 `npm run check` 或 CI。只在受控终端中设置环境变量：

| 变量 | 必填 | 含义 |
| --- | --- | --- |
| `KARKATA_BASE_URL` | 是 | OpenAI-compatible API 根地址，例如以 `/v1` 结尾 |
| `KARKATA_API_KEY` | 是 | 短期或专用测试凭据 |
| `KARKATA_MODEL` | 是 | 目标模型 ID |
| `KARKATA_STREAMING` | 否 | `true`/`1` 验证 SSE 流；默认非流式 |

```bash
npm run test:integration:real
```

命令只发送无业务数据的固定提示，并输出目标 origin、模式和耗时；不会输出 API Key、Authorization、URL 查询参数、完整请求或响应正文。建议发布记录只保存 Provider、模型、模式、日期和通过/失败。真实网络失败或某服务不支持流式，需要单独判断兼容性，不得通过放宽默认 Runtime 测试处理。

## 3. npm 身份与 scope

发布者必须人工确认：

- `npm whoami` 返回预期账户。
- 账户拥有 `@karkata` scope 四个新包的公开发布权限。
- 账户和组织的 2FA、OTP 或 trusted publishing 要求已经满足。
- registry 是预期的 `https://registry.npmjs.org/`，没有被项目或用户配置重定向。
- 包名尚未被其他账户占用；首次查询返回 404 只表示 registry 当前没有公开包，不证明当前账户拥有 scope。

不要把 npm token、OTP 或用户级 `.npmrc` 写入仓库、日志或 issue。

## 4. Dry Run 与发布顺序

逐包运行 npm 自带的 publish dry-run，并核对名称、版本、访问级别和文件列表。首发时先发布 Core，再发布依赖 Core 的包：

1. `@karkata/core`
2. `@karkata/openai-compatible`
3. `@karkata/javascript`
4. `@karkata/ui`

真正的 `npm publish`、Git tag 和 GitHub Release 必须由发布者显式执行。本仓库脚本不会自动完成这些动作。

## 5. 发布后验证与回滚

- 从一个新的临时项目按 registry 版本安装四个包，重复核心 ESM 和类型检查。
- 检查 npm 页面显示中文 README，并能跳转英文版本与 LICENSE。
- 检查 `@karkata/ui/web-component` 子路径和声明文件可解析。
- 记录 tag、commit、npm 版本和真实 Provider smoke 证据。

npm 已发布的同一版本不能覆盖。若首发存在问题，停止后续包发布；对已经发布的错误版本使用 npm deprecate 给出迁移提示，并通过新的 patch 版本修复。只有确定属于恶意或敏感数据泄漏等特殊情况时，才按 npm 的 unpublish 政策处理。
