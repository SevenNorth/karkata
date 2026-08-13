# 变更提案：约束工具返回值契约

## 背景

当前 `Tool<TInput, TOutput>` 的 `TOutput` 没有约束，`defineTool()` 会接受推断为 `void` 或 `undefined` 的执行函数。但 Runtime 无法把 `undefined` 序列化给模型，最终将其作为 `TOOL_EXECUTION_ERROR`。类型契约和运行时契约不一致。

用户已确认：工具成功后必须显式返回模型可见的可序列化结果；只执行操作或不希望暴露业务数据时，返回最小确认对象，例如 `{ success: true }`。

## 目标

- 新增公开递归 `ToolOutput` 类型，表达允许进入模型上下文的 JSON 风格值。
- 通过推荐入口 `defineTool()` 约束推断输出必须属于 `ToolOutput`，底层 `Tool` 保持可擦除执行协议。
- 在编译期拒绝 `void`、`undefined`、`bigint`、函数和 symbol 等明显无效输出。
- 保留 Runtime 最终序列化检查，防御循环引用和类型绕过。
- 文档明确纯操作工具和敏感结果的推荐返回方式。

## 范围

- 修改 `@karkata/core` 的公开 Tool 类型契约。
- 增加编译期类型测试与运行时工具结果回归测试。
- 将 `@karkata/javascript` 的输出从 `unknown` 收紧为 `ToolOutput`，并校验脚本实际返回值。
- 更新 README、Runtime 设计和工具注册设计基线。

## 非目标

- 不自动把 `undefined` 规范化为成功结果。
- 不引入自定义工具结果序列化器。
- 不改变 Tool Result 消息格式、长度限制或错误码。
- 不保证仅凭 TypeScript 类型发现循环引用或 class 实例。

## 验收标准

- [x] `ToolOutput` 支持 string、number、boolean、null、递归数组和普通对象。
- [x] `defineTool()` 对同步与异步 `execute()` 的推断输出均要求模型可见。
- [x] `defineTool()` 在编译期拒绝 `void` 和 `undefined` 返回值。
- [x] 普通结构化结果仍按既有 JSON 格式发送给模型。
- [x] 类型绕过或循环引用仍由 Runtime 转换为工具执行错误。
- [x] JavaScript 工具直接执行时只返回有效 `ToolOutput`，无返回值、函数、bigint、循环引用和 class 实例会失败。
- [x] README 与设计文档说明纯操作工具必须显式返回最小确认结果。

## 风险

- 这是公共类型收紧；此前返回 `void` 的工具会出现编译错误，这是有意的缺陷前移。
- 递归 JSON 类型无法完全排除 class 实例和运行时循环引用，因此不能移除序列化兜底。
- JavaScript 工具原本允许任意脚本结果；收紧后依赖 Date、Map、Set 或自定义实例返回值的脚本必须先显式映射为普通对象。

## 待确认项

- 无。用户已明确接受方案并要求实施。
