# @karkata/javascript

[Documentation](https://sevennorth.github.io/karkata/en/guide/tools) | English | [中文](https://github.com/SevenNorth/karkata/blob/main/packages/javascript/README.md)

An explicitly registered JavaScript execution tool for Karkata. It runs code in the host's current Realm. It is **not a security sandbox** and must only be used with fully trusted scripts.

## Installation

```bash
npm install @karkata/core @karkata/javascript
```

## Usage

```ts
import { Agent } from '@karkata/core'
import { createUnsafeJavaScriptTool } from '@karkata/javascript'

const javascript = createUnsafeJavaScriptTool({
  globals: { formatCurrency },
})

const agent = new Agent({ llm, tools: [javascript] })
```

The model supplies `{ script: string }`. The script can access explicitly provided globals and the current run's `AbortSignal`. Its return value must be a serializable, model-visible `ToolOutput`.

This package cannot isolate network, file system, DOM, CPU, memory, or host globals. It must not execute user input, third-party content, or untrusted model-generated code. Core never enables this tool automatically.

See the [Karkata repository](https://github.com/SevenNorth/karkata) for the full security boundary.

## License

[MIT](https://github.com/SevenNorth/karkata/blob/main/LICENSE)
