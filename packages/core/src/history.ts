import type { AgentMessage } from './types.js'

export class HistoryValidationError extends Error {
  override readonly name = 'HistoryValidationError'
}

export function validateCommittedHistory(value: unknown): asserts value is readonly AgentMessage[] {
  if (!Array.isArray(value)) throw new HistoryValidationError('Compacted history must be an array')

  const callNames = new Map<string, string>()
  const pendingCalls = new Map<string, string>()

  for (const message of value) {
    if (!isRecord(message) || typeof message.role !== 'string') throw new HistoryValidationError('Compacted history contains an invalid message')

    if (message.role === 'system' || message.role === 'user') {
      if (pendingCalls.size > 0 || typeof message.content !== 'string' || !message.content.trim()) {
        throw new HistoryValidationError('Compacted history contains an invalid text message')
      }
      continue
    }

    if (message.role === 'assistant') {
      if (pendingCalls.size > 0) throw new HistoryValidationError('Compacted history contains unresolved tool calls')
      const content = message.content
      const toolCalls = message.toolCalls
      if ((content !== null && typeof content !== 'string') || (toolCalls !== undefined && !Array.isArray(toolCalls))) {
        throw new HistoryValidationError('Compacted history contains an invalid assistant message')
      }
      if ((content === null || content.length === 0) && (!toolCalls || toolCalls.length === 0)) {
        throw new HistoryValidationError('Compacted history contains an empty assistant message')
      }
      if (toolCalls) {
        for (const call of toolCalls) {
          if (!isRecord(call) || typeof call.callId !== 'string' || !call.callId.trim() || typeof call.name !== 'string' || !call.name.trim()) {
            throw new HistoryValidationError('Compacted history contains an invalid tool call')
          }
          if (callNames.has(call.callId)) throw new HistoryValidationError('Compacted history contains a duplicate tool call ID')
          callNames.set(call.callId, call.name)
          pendingCalls.set(call.callId, call.name)
        }
      }
      continue
    }

    if (message.role === 'tool') {
      if (typeof message.callId !== 'string' || typeof message.name !== 'string' || typeof message.content !== 'string' || typeof message.isError !== 'boolean') {
        throw new HistoryValidationError('Compacted history contains an invalid tool result')
      }
      const expectedName = pendingCalls.get(message.callId)
      if (expectedName === undefined) throw new HistoryValidationError('Compacted history contains an unmatched tool result')
      if (expectedName !== message.name) throw new HistoryValidationError('Compacted history contains a mismatched tool result')
      pendingCalls.delete(message.callId)
      continue
    }

    throw new HistoryValidationError('Compacted history contains an unsupported message role')
  }

  if (pendingCalls.size > 0) throw new HistoryValidationError('Compacted history contains unresolved tool calls')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
