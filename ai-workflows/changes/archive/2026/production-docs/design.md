# 技术设计：完善官网生产接入文档

## 现状分析

已读取 `website/page-manifest.mjs`、VitePress 配置、现有中英文快速开始/安全/Provider 页面、`scripts/docs/site-contract.mjs`、Core 类型和设计基线。当前 manifest 有 13 组双语页面，站点契约验证页面配对、frontmatter、内部链接、图片与疑似凭据；现有安全页只有 29 行，Provider 页只有 27 行，尚未形成生产上线路径。

## 方案

新增独立 `production` 路由组，避免把大量生产责任塞进快速开始或把应用安全误写成 Core 功能：

1. `architecture` 比较浏览器直连、服务端 Agent、浏览器 Agent + 受限同源网关三种拓扑，并给出选择标准。
2. `security` 说明凭据、身份、工具授权、代理滥用、数据最小化、日志和取消后的副作用。
3. `configuration` 按 Core 与 OpenAI-compatible 分组记录当前公开配置和生产建议，不发明默认值。
4. `errors` 按错误来源、retryable、HTTP 分类和 UI 显示策略说明恢复路径。
5. `deployment` 给出环境变量、构建、反向代理/SSE、健康检查、可观测性和上线清单，并明确部署方仍需实现受限后端。

manifest 先增加页面形成 Red，随后补齐双语正文、导航和交叉链接形成 Green。现有 `/guide/security` 保留为 Runtime 安全边界摘要，并链接到生产安全页。

## 影响范围

| 包或区域 | 文件 | 变更 |
| --- | --- | --- |
| website content | `website/production/**`、`website/en/production/**` | 新增五组双语生产文档 |
| website routing | `website/page-manifest.mjs`、`website/.vitepress/config.mts` | 注册路由与中英文导航 |
| adjacent docs | 快速开始、安全、Provider 页面 | 增加生产路径链接，避免重复正文 |
| release docs | `docs/RELEASING.md` | 修正旧 npm scope 文本 |
| change | `ai-workflows/changes/active/production-docs/**` | 记录范围、验证和决策 |

## Runtime 契约

无变化。文档只解释当前已发布的消息、工具、状态、错误、取消、超时和配置契约；应用后端、身份、授权、限流和部署仍属于宿主责任。

## 兼容性与迁移

新增路由，不删除或重定向既有页面；中英文路由保持镜像。示例使用 `@karkata-ai/*@0.1.0` 当前 API。回滚可以移除新增页面和导航，不影响包或运行时。

## TDD 与验证方案

- Red：先在 manifest 注册五组路由，运行 `npm run test:docs`，应因 10 个 Markdown 文件缺失而失败。
- Green：补齐 frontmatter、正文、导航和内部链接，重新运行 `npm run test:docs`。
- Refactor：交叉核对中英文标题层级、配置名、错误码和链接，运行文档示例类型检查与静态构建。
- 最终：运行 `npm run docs:build`、`npm run check`、`git diff --check`，确认无生产代码或生成物进入提交。
