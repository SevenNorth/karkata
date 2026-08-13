# 功能开发工作流

1. 读取 `AGENTS.md`，定位所属包、公共导出、相邻实现和测试。
2. 创建 `feature` change，依次填写 proposal、design、tasks 和 progress。
3. 在 design 中明确消息、状态、工具、错误或配置契约，并把验收标准映射为测试场景。
4. 评估变更规模，必要时在 approved 前向用户提出拆分建议。
5. 校验 change 并等待用户明确批准；未批准前不修改生产代码。
6. 进入 implementing，按行为切片执行 Red-Green-Refactor。每完成一项立即更新 tasks 和 progress。
7. 范围或契约实质变化时暂停实现，执行 revise，更新文档并重新确认。
8. 运行包级测试、`npm run check`；修改共享控制流或发布表面时运行覆盖率和打包预检。
9. 完成全部验收标准和验证记录后流转 completed 并归档。

重点检查：跨 Node/浏览器兼容、输入运行时校验、取消传播、迟到结果、状态快照、工具版本一致性、错误分类和敏感信息泄漏。

