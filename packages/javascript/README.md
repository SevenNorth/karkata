# @karkata-ai/javascript

[文档](https://sevennorth.github.io/karkata/guide/tools) | [English](https://github.com/SevenNorth/karkata/blob/main/packages/javascript/README.en.md) | 中文

为 Karkata 提供显式注册的 JavaScript 执行工具。它在宿主当前 Realm 中运行代码，**不是安全沙箱**，只能用于完全可信的脚本。

## 安装

```bash
npm install @karkata-ai/core @karkata-ai/javascript
```

## 使用

```ts
import { Agent } from '@karkata-ai/core'
import { createUnsafeJavaScriptTool } from '@karkata-ai/javascript'

const javascript = createUnsafeJavaScriptTool({
  globals: { formatCurrency },
})

const agent = new Agent({ llm, tools: [javascript] })
```

模型传入 `{ script: string }`，脚本可以访问显式提供的 globals 和当前运行的 `AbortSignal`。返回值必须是可序列化、模型可见的 `ToolOutput`。

该包不能隔离网络、文件系统、DOM、CPU、内存或宿主全局对象，也不适合执行用户输入、第三方内容或模型生成的不可信代码。Core 不会自动启用这个工具。

完整安全边界见 [Karkata 仓库](https://github.com/SevenNorth/karkata)。

## License

[MIT](https://github.com/SevenNorth/karkata/blob/main/LICENSE)
