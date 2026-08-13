# Karkata AI 协作工作流

`ai-workflows` 保存可执行流程、模板和可恢复的完整变更现场。根目录 `AGENTS.md` 负责流程路由和硬约束，本目录负责一次变更如何提出、批准、实施、验证和恢复。

`docs/design/` 是已采纳架构与 Runtime 契约的长期基线。完整变更若修改公共契约，design 必须列出受影响的仓库内设计文档，实施和验收时同步更新；外部讨论归档只提供背景，不作为流程输入依赖。

## 目录

```text
ai-workflows/
├── workflows/              # 轻量修改、功能、缺陷和重构流程
├── templates/              # 完整变更文档模板
└── changes/
    ├── active/<change-id>/  # 正在讨论或实施的变更
    └── archive/<year>/      # 已完成变更
```

每个完整变更包含：

- `_meta.json`：状态、类型、分支和更新时间，由脚本维护。
- `proposal.md`：背景、目标、范围、非目标、验收标准和风险。
- `design.md`：现状、方案、Runtime 契约、兼容性和测试设计。
- `tasks.md`：按依赖顺序排列的 Red-Green-Refactor 任务和验证记录。
- `progress.md`：当前任务、Red/Green 状态、修改文件、决策、阻塞和下一步。

## 流程选择

日常局部修改使用 `workflows/lightweight-change.md`，不创建 change。新功能、公共契约、异步控制流、跨包或高风险改动使用完整流程，判断标准以根目录 `AGENTS.md` 为准。

## 完整流程

```text
draft -> approved -> implementing -> completed -> archived
          ^
          只有用户明确批准后才能进入
```

AI 不得代替用户批准自己的提案。范围或契约实质变化时，运行 `npm run ai:change:revise -- <change-id>` 退回 draft，更新文档并重新获得批准。

```bash
# 创建变更
npm run ai:change:new -- agent-events feature "增加结构化 Agent 事件"

# 填写 proposal/design/tasks/progress 后校验
npm run ai:change:validate -- agent-events

# 校验所有活动变更
npm run ai:change:validate -- all

# 仅在用户明确批准后流转并实施
npm run ai:change:status -- agent-events approved
npm run ai:change:status -- agent-events implementing

# 完成验收标准、TDD 任务和验证记录后
npm run ai:change:status -- agent-events completed
npm run ai:change:archive -- agent-events
```

### TDD 在完整流程中的位置

proposal 用用户可见结果定义验收标准；design 把每个关键行为映射为测试场景；tasks 按 Red、Green、Refactor 和验证顺序拆解。进入 implementing 后，每个行为切片都必须先记录失败测试，再实现生产代码。

不得把所有测试集中到实施末尾。`tasks.md` 中一个行为任务只有在对应 Red 证据、Green 结果和必要重构均完成后才能勾选。

## 大型变更拆分

draft 阶段按 `AGENTS.md` 评估规模：

- 同一验收目标在一个 change 中拆 tasks。
- 可独立验证和回滚的结果可建议拆 Git 提交，但仍需用户明确授权提交。
- 独立交付、审批或风险边界拆为多个 change，并记录依赖顺序。

不要只为满足数量标准拆散内聚变更，也不要未经用户确认自动创建多个 change。

## 中断恢复

```bash
npm run ai:change:list
npm run ai:change:resume -- agent-events
```

`resume` 输出状态、分支、任务进度和下一步。恢复后仍须检查实际 Git 工作区，文档记录不能替代 diff。

## 脚本边界

`scripts/ai-change.mjs` 负责创建目录、校验文档、限制状态跳转和输出恢复摘要。脚本无法判断用户是否真的批准，因此 AI 必须同时遵守 `AGENTS.md`。

第一版不使用 Git Hook，不自动创建分支或提交，也不自动改写 change 正文。

## 维护原则

- 稳定项目约束放入 `AGENTS.md`。
- 可重复流程放入 `workflows/`。
- 一次性需求、设计和验证证据放入具体 change。
- 已采纳且需要长期维护的架构和 Runtime 契约沉淀到 `docs/design/`。
- 规则保持短、可执行、可验证，及时删除过时内容。
