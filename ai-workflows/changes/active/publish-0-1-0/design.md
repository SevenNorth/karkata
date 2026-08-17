# 技术设计：发布 Karkata 0.1.0

## 现状分析

已读取 `docs/RELEASING.md`、四个 workspace `package.json`、`scripts/release/` 测试与 smoke、根 `package.json`、当前 Git 状态和已归档 `release-readiness-integration`。四包版本均为 `0.1.0`，包的 `files` 白名单包含 `dist`、双语 README、LICENSE；npm registry 当前查询不到 `@karkata-ai/core`。

## 方案

scope 迁移改变包标识和导入路径，但不改变 Runtime 行为。实施顺序固定为：

1. 将四包名称、内部依赖、源码导入、测试别名、发布脚本、README、网站和设计基线统一迁移至 `@karkata-ai/*`，通过 npm 重新生成 lockfile；历史归档 change 保持不变。
2. 验证干净工作区、Node/npm、四包版本、npm registry、`npm whoami` 和 `karkata-ai` 组织权限；没有凭据时停止在前置检查。
3. 运行本地完整门禁和 `npm pack --workspaces --dry-run`，人工核对四包内容只包含发布白名单。
4. 如有受控 Provider 环境，运行显式 opt-in 的真实 smoke；不把真实网络调用接入默认 CI。
5. 依次发布 Core、OpenAI-compatible、JavaScript、UI。每个包成功后记录版本和 registry URL；任一步失败停止。
6. 在临时消费者目录安装 registry 版本，运行既有 package smoke 覆盖 ESM、类型、Provider 和 UI 子路径。
7. 四包验证成功后创建并推送 `v0.1.0`，再创建 GitHub Release；Release 只包含公开变更摘要。

不采用一次性并行发布，因为下游包依赖 Core，且并行失败会扩大半发布状态。

## 影响范围

| 包或区域 | 文件 | 变更 |
| --- | --- | --- |
| release | `docs/RELEASING.md`、`scripts/release/**` | 复用现有门禁和隔离消费者验证，不修改 Runtime |
| packages | `packages/*/package.json`、源码导入、测试配置、lockfile | scope 迁移为 `@karkata-ai/*`，版本与内部依赖保持 `0.1.0` |
| docs/release | README、`website/**`、`docs/**`、`scripts/release/**` | 同步安装示例、设计基线与发布验证；不改历史归档 |
| git/GitHub | `v0.1.0` tag、GitHub Release | 仅在 npm 发布和 registry smoke 全部通过后创建 |

## Runtime 契约

Runtime 行为契约不变。npm 包标识和消费者导入路径从原 scope 变更为 `@karkata-ai/*`；原 scope 从未发布，因此不提供兼容层。

## 兼容性与迁移

发布物保持 Node.js `>=20` 包边界，仓库开发使用 Node.js `>=22.18.0`。旧 scope 从未发布，没有现有 npm 消费者迁移负担；仓库内所有当前引用必须原子更新。npm 同版本不可覆盖；发布失败时停止后续包，不创建 tag/Release，并通过新的 patch 版本 change 修复。npm token、OTP 和 Provider 凭据不进入 Git。

## TDD 与验证方案

本 change 不引入生产行为，Red/Green 以发布前置和消费者契约为边界：

- Red：未登录 npm、缺包或错误版本、dry-run 白名单不符、临时消费者无法安装时必须失败。
- Green：身份与版本前置通过，`npm run check`、release/package smoke、coverage 和 dry-run 通过。
- 发布后：每个 registry 包执行隔离消费者验证；真实 Provider 仅在显式凭据存在时执行。
- 最终：四包版本、tag、Release、远端安装和 change 记录一致；`git status` 干净。
