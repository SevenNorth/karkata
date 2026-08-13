import type { ModelErrorCode } from './types.js'

const MODEL_ERROR_CODES: readonly ModelErrorCode[] = [
  'MODEL_NETWORK_ERROR',
  'MODEL_AUTH_ERROR',
  'MODEL_RATE_LIMIT',
  'MODEL_INVALID_RESPONSE',
  'MODEL_PROVIDER_ERROR',
]

export class AgentBusyError extends Error { override name = 'AgentBusyError' }
export class AgentDisposedError extends Error { override name = 'AgentDisposedError' }
export class ToolRegistrationError extends Error { override name = 'ToolRegistrationError' }

export interface ModelErrorOptions {
  readonly code: ModelErrorCode
  readonly message: string
  readonly retryable: boolean
  readonly statusCode?: number
  readonly cause?: unknown
}

export class ModelError extends Error {
  override readonly name = 'ModelError'
  readonly code: ModelErrorCode
  readonly retryable: boolean
  readonly statusCode: number | undefined

  constructor(options: ModelErrorOptions) {
    super(options.message, { cause: options.cause })
    if (!MODEL_ERROR_CODES.includes(options.code)) throw new TypeError('Model error code is invalid')
    if (!options.message.trim()) throw new TypeError('Model error message must not be empty')
    if (typeof options.retryable !== 'boolean') throw new TypeError('Model error retryable must be a boolean')
    if (options.statusCode !== undefined && (!Number.isFinite(options.statusCode) || !Number.isInteger(options.statusCode))) {
      throw new TypeError('Model error statusCode must be a finite integer')
    }
    this.code = options.code
    this.retryable = options.retryable
    this.statusCode = options.statusCode
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
