import { z } from 'zod'
import type { AgentRequest, HumanInputConfig, LLMToolDefinition } from './types.js'

export const HUMAN_INPUT_TOOL_NAME = 'ask_user'

const HUMAN_INPUT_SCHEMA = z.object({ question: z.string().trim().min(1) })

export const HUMAN_INPUT_TOOL: LLMToolDefinition = Object.freeze({
  name: HUMAN_INPUT_TOOL_NAME,
  description: 'Ask the user a question and wait for their answer. Use this when required information or confirmation is missing.',
  inputSchema: HUMAN_INPUT_SCHEMA,
})

export function parseHumanInput(value: unknown): ReturnType<typeof HUMAN_INPUT_SCHEMA.safeParse> {
  return HUMAN_INPUT_SCHEMA.safeParse(value)
}

export function createHumanInputRequest(runId: string, step: number, callId: string, prompt: string): AgentRequest {
  return Object.freeze({
    type: 'human_input',
    id: globalThis.crypto.randomUUID(),
    callId,
    runId,
    step,
    prompt,
  })
}

export function validateHumanInputConfig(value: unknown): asserts value is HumanInputConfig | undefined {
  if (value === undefined) return
  if (value === null || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype || Reflect.ownKeys(value).length > 0) {
    throw new TypeError('humanInput must be an empty configuration object')
  }
}
