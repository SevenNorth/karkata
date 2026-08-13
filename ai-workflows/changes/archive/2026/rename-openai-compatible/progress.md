# 实施进度：重命名 OpenAI 兼容协议包

## 当前状态

- 当前任务：已完成并归档
- TDD 阶段：完成
- 最后完成：重命名、全仓测试、覆盖率、干净构建、打包与声明检查
- 阻塞项：无

## 已修改文件

- `ai-workflows/changes/archive/2026/rename-openai-compatible/*`
- `packages/openai-compatible/**`
- `package-lock.json`
- `tsconfig.json`
- `vitest.config.ts`
- `scripts/clean.mjs`
- `AGENTS.md`
- `README.md`
- `docs/design/Karkata无头智能体运行时设计.md`

## 关键决策

- 使用 `@karkata/openai-compatible` 表达 OpenAI 风格兼容协议，而非官方厂商绑定。
- 公开类和类型同步采用 `OpenAICompatible*`。
- 工厂继续命名为 `createAgent()`。
- 项目未发布，不保留旧包或旧类型别名。
- 历史 change 归档不追溯改写。

## 验证记录

- Red：工厂 2 项测试通过，Adapter 2 项因新类未导出失败。
- Green：重命名源码和入口并同步 TS/Vitest 路径后，聚焦测试 4/4 通过。
- Refactor：新包 typecheck 通过，当前源码与设计基线旧名称检索为零。
- 全仓门禁：3 个测试文件 31/31、类型检查和三个 workspace 构建通过。
- 覆盖率：全仓行覆盖率 90.45%。
- 首次并行 pack 与 build 产生竞态，结果作废；随后发现 clean 脚本仍指向旧目录并修复。
- 最终顺序执行 `clean -> build -> pack --dry-run` 通过，三个包产物完整，新包不含旧类文件。
- 声明检查：新包只公开 `OpenAICompatibleAdapter`、两个新配置类型和 `createAgent()`。

## 下一步

- 无。
