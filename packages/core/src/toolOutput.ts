import type { ToolOutput } from './types.js'

export function serializeToolOutput(value: unknown): string {
  if (!isToolOutput(value)) throw new TypeError('Tool output must be a model-visible ToolOutput')
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function isToolOutput(value: unknown, ancestors = new Set<object>()): value is ToolOutput {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value !== 'object') return false

  if (ancestors.has(value)) return false
  ancestors.add(value)
  try {
    if (Array.isArray(value)) return value.every((item) => isToolOutput(item, ancestors))
    const prototype = Object.getPrototypeOf(value) as unknown
    if (prototype !== Object.prototype && prototype !== null) return false
    if (Object.getOwnPropertySymbols(value).length > 0) return false
    return Object.values(value).every((item) => isToolOutput(item, ancestors))
  } finally {
    ancestors.delete(value)
  }
}
