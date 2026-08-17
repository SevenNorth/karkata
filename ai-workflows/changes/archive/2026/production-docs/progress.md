# 实施进度：完善官网生产接入文档

## 当前状态

- 当前任务：任务 6，完成并归档 change
- TDD 阶段：Red/Green/Refactor 已完成
- 最后完成：文档契约、静态构建和全仓 check 通过
- 阻塞项：无

## 已修改文件

- `ai-workflows/changes/active/production-docs/{proposal,design,tasks,progress}.md`
- `website/production/**`、`website/en/production/**`
- `website/page-manifest.mjs`、`website/.vitepress/config.mts`
- `website/guide/security.md`、`website/en/guide/security.md`
- `website/provider/openai-compatible.md`、`website/en/provider/openai-compatible.md`
- `scripts/docs/site-contract.test.mjs`
- `docs/RELEASING.md`

## 关键决策

- 新增五组双语页面，保留现有安全摘要页并通过链接分层。
- 不提供透明开放代理实现；生产网关只作为宿主责任和安全要求描述。
- 用户已明确批准该文档范围，不包含新后端。
- 生产网关只作为宿主责任和安全要求描述，不把透明转发示例误写成 Karkata 内置能力。

## 验证记录

- Red：manifest 注册新路由后 `npm run test:docs` 因页面清单预期/页面缺失失败。
- Green：补齐 10 个中英文页面、导航和测试期望后 `npm run test:docs` 通过。
- `npm run docs:build`：通过，静态输出 36 routes。
- `npm run check`：通过，182 项测试、typecheck 和四包 build 通过。
- `git diff --check`：通过。

## 下一步

- 流转 completed 并归档；不主动创建 Git commit，等待用户审阅后再决定提交。
