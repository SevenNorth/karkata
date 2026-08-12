import { ToolRegistrationError } from './errors.js'
import type { Tool } from './types.js'

export interface ToolRegistration {
  readonly registrationId: string
  readonly scope: string
  readonly tool: Tool
}
export interface ToolSnapshot {
  readonly registryRevision: number
  readonly registrations: ReadonlyMap<string, ToolRegistration>
}

export class ToolRegistry {
  #records = new Map<string, ToolRegistration>()
  #revision = 0

  register(tool: Tool, scope = 'global'): () => boolean {
    this.#validate(tool, scope)
    if (this.#records.has(tool.name)) throw new ToolRegistrationError(`Tool already registered: ${tool.name}`)
    const record = this.#record(tool, scope)
    this.#records.set(tool.name, record); this.#revision++
    return () => {
      const current = this.#records.get(tool.name)
      if (current?.registrationId !== record.registrationId) return false
      this.#records.delete(tool.name); this.#revision++; return true
    }
  }

  unregister(name: string, scope = 'global'): boolean {
    const current = this.#records.get(name)
    if (!current || current.scope !== scope) return false
    this.#records.delete(name); this.#revision++; return true
  }

  replace(tool: Tool, scope = 'global'): void {
    this.#validate(tool, scope)
    const current = this.#records.get(tool.name)
    if (!current || current.scope !== scope) throw new ToolRegistrationError(`Tool not registered in scope ${scope}: ${tool.name}`)
    this.#records.set(tool.name, this.#record(tool, scope)); this.#revision++
  }

  replaceScope(scope: string, tools: readonly Tool[]): void {
    const names = new Set<string>()
    for (const tool of tools) {
      this.#validate(tool, scope)
      if (names.has(tool.name)) throw new ToolRegistrationError(`Duplicate tool in scope: ${tool.name}`)
      const other = this.#records.get(tool.name)
      if (other && other.scope !== scope) throw new ToolRegistrationError(`Tool conflicts with scope ${other.scope}: ${tool.name}`)
      names.add(tool.name)
    }
    const next = new Map([...this.#records].filter(([, record]) => record.scope !== scope))
    for (const tool of tools) next.set(tool.name, this.#record(tool, scope))
    this.#records = next; this.#revision++
  }

  snapshot(): ToolSnapshot {
    return { registryRevision: this.#revision, registrations: new Map(this.#records) }
  }
  isCurrent(record: ToolRegistration): boolean {
    return this.#records.get(record.tool.name)?.registrationId === record.registrationId
  }
  clear(): void { this.#records.clear(); this.#revision++ }
  #record(tool: Tool, scope: string): ToolRegistration { return { tool, scope, registrationId: globalThis.crypto.randomUUID() } }
  #validate(tool: Tool, scope: string): void {
    if (!tool.name.trim() || !tool.description.trim() || !scope.trim() || typeof tool.execute !== 'function') {
      throw new ToolRegistrationError('Tool name, description, scope, schema, and execute are required')
    }
  }
}
