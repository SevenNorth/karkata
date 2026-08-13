# 实施进度：增加 Human-in-the-Loop 用户输入协议

## 当前状态

- 当前任务：流转 completed 并归档
- TDD 阶段：Refactor 完成
- 最后完成：任务 5-7，终止竞态验证与内部结构整理
- 阻塞项：无

## 已修改文件

- `ai-workflows/changes/active/human-in-the-loop/*`

## 关键决策

- 采用模型侧固定 `ask_user` 特殊工具、宿主侧 `subscribeRequests()` / `respond()` 的双层协议。
- 首版只支持非空字符串问答；不提前固化 choice、表单或审批策略 Schema。
- 请求等待复用整次运行的 `timeoutMs`，不增加独立请求超时。
- `ask_user` 仅在显式配置 `humanInput: {}` 时注入，且不进入普通 Tool Registry。
- 模型主动确认不是安全边界，工具级强制审批不在本 change 范围。

## 验证记录

- draft change 校验通过。
- 用户批准后已流转 approved -> implementing。
- 第一轮 Red：新增 2 项因请求 API 缺失可靠失败，其余 56 项通过。
- 第一轮 Green：Core 聚焦测试 58/58，Core 类型检查通过。
- 第二轮 Red：新增边界场景中 2 项可靠失败，定位回答长度限制和保留名称保护缺口。
- 第二轮 Green：增加长度限制与启用期名称保护后 Core 64/64，Core 类型检查通过。
- 第三轮终止场景：新增取消、超时、dispose、busy 和旧请求隔离 5 项直接通过，复用了现有可取消等待与 runId 门禁。
- 配置加固 Red：`null`、数组和带未知字段对象 3 项可靠失败；增加严格空对象检查后 Core 72/72。
- Refactor：提取 `humanInput.ts` 和共享 Tool Result 截断逻辑后 Core 72/72，Core 类型检查通过。
- 全仓 `npm run check`：通过，3 个测试文件 104/104，类型检查和三个 workspace 构建通过。
- 覆盖率：行 97.51%，分支 89.61%。
- workspace 打包预检：三个包通过，未生成 `.tgz`。
- 声明检查：请求类型、等待状态、配置、`subscribeRequests()` / `respond()` 和 Provider 工厂透传符合批准契约；内部特殊工具未从包入口导出。
- change 最终校验与 `git diff --check`：通过，Git 变更清单无非预期文件。

## 下一步

- 最终校验 change 与 Git diff，流转 completed 并归档。
