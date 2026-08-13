# 设计：工具返回值契约

## 现状分析

当前 `Tool<TInput = unknown, TOutput = unknown>` 允许任意输出，`defineTool()` 对 `execute` 返回值没有有效限制。Runtime 执行后通过 `JSON.stringify` 序列化；顶层 `undefined`、函数和 symbol 得到 `undefined`，bigint 或循环引用抛异常，最终转换为工具错误。

## 方案

在 Core 公开类型中增加：

```ts
export type ToolOutput =
  | string
  | number
  | boolean
  | null
  | readonly ToolOutput[]
  | { readonly [key: string]: ToolOutput }
```

并通过 `defineTool()` 的递归条件类型校验推断输出：

```ts
defineTool({
  execute: () => ({ success: true }),
  // 其余字段省略
})
```

直接使用 `TOutput extends ToolOutput` 会误拒绝没有字符串索引签名的命名业务 interface，因此 `defineTool()` 使用递归条件类型逐字段校验，并对显式 `ToolOutput` 短路。允许 readonly 容器，便于返回冻结快照；不允许对象属性为 `undefined`，避免 JSON 静默丢字段。底层 `Tool` 仍是可擦除的执行协议，显式强转或手写底层类型可能绕过编译期校验，Runtime 必须兜底。

## Runtime 契约

- 成功工具必须显式返回 `ToolOutput`。
- 纯操作工具推荐返回 `{ success: true }`。
- 不希望暴露业务返回值时，由工具映射为最小安全 DTO。
- Runtime 继续对实际值执行递归校验、序列化和长度限制，拒绝非有限数字、非普通对象、symbol 属性和循环引用。
- 序列化失败仍返回 `TOOL_EXECUTION_ERROR`，不终止整个 Agent 循环。

`@karkata/javascript` 是动态执行边界，TypeScript 无法约束脚本内容。其 `execute()` 在脚本完成后递归验证实际结果，只接受有限 number、string、boolean、null、数组和普通对象，并检测循环引用。校验成功后返回 `ToolOutput`；校验失败时抛出明确错误，由 Core Agent 转换为 `TOOL_EXECUTION_ERROR`。直接调用该工具的 `execute()` 时同样会收到拒绝，而不是获得一个与声明不符的值。

## 兼容性与迁移

返回 string、number、boolean、null、普通数组和普通对象的现有工具无需修改。返回 `void` 或 `undefined` 的工具需显式返回结果：

```ts
execute: async () => {
  await performAction()
  return { success: true }
}
```

## TDD 与验证方案

- Red：类型测试证明 `void`/`undefined` 当前可被 `defineTool()` 接受。
- Green：新增 `ToolOutput` 并约束 `Tool`、`defineTool()` 泛型，使负例产生预期编译错误。
- 回归：运行时验证递归结构正常序列化，循环引用或越界值仍反馈工具错误。
- JavaScript 包 Red/Green：先将其签名收紧暴露 `unknown` 冲突，再增加动态结果校验，覆盖有效结果、无返回值、函数、bigint、循环引用和 class 实例。
- 验证：Core 聚焦测试、全仓 check、coverage、干净构建、workspace pack dry-run、声明与 change 校验。

## 影响范围

- `packages/core/src/types.ts`
- `packages/core/src/Agent.test.ts`
- `packages/core/type-tests/tool-output.ts`
- `packages/core/tsconfig.type-tests.json`
- `packages/core/package.json`
- `package.json`
- `packages/javascript/src/createUnsafeJavaScriptTool.ts`
- `packages/javascript/src/createUnsafeJavaScriptTool.test.ts`
- `README.md`
- `docs/design/Karkata无头智能体运行时设计.md`
- `docs/design/Karkata工具注册与版本一致性.md`
