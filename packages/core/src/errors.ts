export class AgentBusyError extends Error { override name = 'AgentBusyError' }
export class AgentDisposedError extends Error { override name = 'AgentDisposedError' }
export class ToolRegistrationError extends Error { override name = 'ToolRegistrationError' }

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

