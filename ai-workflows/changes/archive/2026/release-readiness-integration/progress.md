# 实施进度：准备 0.1.0 发布与真实集成验证

## 当前状态

- 当前任务：完成验收并归档
- TDD 阶段：Red-Green-Refactor 已完成
- 最后完成：完整门禁和 tarball 文件核对
- 阻塞项：无

## 已修改文件

- 根清单、lockfile、MIT LICENSE、中文 README 与英文 README
- 四个 `packages/*/package.json`、LICENSE、中文 README 与英文 README
- `scripts/release/` 发布元数据测试、tarball 消费者、类型/运行 fixture 和真实 Provider smoke
- `docs/RELEASING.md`
- `docs/design/Karkata无头智能体运行时设计.md`
- 当前 change 的 proposal/design/tasks/progress

## 关键决策

- checkpoint 与外部持久化明确暂缓，不是 0.1.0 发布前置条件。
- 根与包 `README.md` 为中文默认入口，`README.en.md` 为英文版本。
- 使用 MIT License，许可证文本随每个 tarball 发布。
- 发布包声明 Node.js `>=20`；仓库开发仍要求 Node.js `>=22.18.0` 和 npm `>=11`。
- tarball smoke 使用系统临时目录，安装真实本地包并在所有退出路径安全清理。
- 真实 Provider smoke 显式 opt-in，不进入默认测试或 CI，也不输出凭据、查询参数或响应正文。
- 实际发布、版本提升、tag 和 release 保持人工动作，不由验证脚本执行。

## 验证记录

- 发布元数据 Red：2 项失败，分别为缺少 Core `license` 和根 LICENSE；Green：2 项通过。
- tarball smoke Red：模块不存在；Green：白/黑名单 2 项通过，完整消费者验证四包通过。
- 真实 smoke Red：模块不存在；Green：配置、URL/流式校验和脱敏输出 3 项通过。
- `npm run check`：通过，类型检查、182 项测试和四包构建成功。
- `npm run test:release`：通过，7 项测试成功。
- `npm run test:coverage`：通过；statements 90.52%、branches 85.72%、functions 91.18%、lines 94.45%。
- `npm run test:package`：通过；四个 tarball 安装、类型、ESM、本地 Provider、JavaScript 工具和 UI 子路径验证成功。
- `npm pack --workspaces --dry-run --json`：通过；Core 44、JavaScript 12、OpenAI-compatible 16、UI 20 个文件，必需文件齐全且意外文件均为 0。
- 真实外部 Provider：未运行，当前未提供受控环境变量；不会因此调用外部服务或产生费用。

## 下一步

- 将 change 流转为 completed 并归档；等待用户审查工作区并决定是否按阶段创建提交。
