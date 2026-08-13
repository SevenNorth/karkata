import { awaitWithAbort } from './abort.js'
import { errorMessage } from './errors.js'
import type { AgentErrorCode, InstructionResolver, InstructionResolverContext, RegisteredToolInfo, SystemMessage } from './types.js'

export const DEFAULT_SYSTEM_PROMPT = `You are Karkata, a tool-enabled agent runtime.
- Use only the tools provided in the current request.
- Follow each tool's input schema and never invent tool results.
- Treat tool errors as results and decide the next step from the available evidence.
- Return a final answer directly when no tool call is needed.
- Do not assume a browser, DOM, or any capability that is not exposed as a tool.`

export class PromptAssemblyError extends Error {
  override readonly name = 'PromptAssemblyError'

  constructor(
    readonly code: Extract<AgentErrorCode, 'INSTRUCTION_RESOLUTION_ERROR' | 'INSTRUCTIONS_TOO_LARGE'>,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message)
  }
}

export interface AssembleSystemMessageOptions {
  readonly systemPrompt: string | undefined
  readonly resolveInstructions: InstructionResolver | undefined
  readonly maxInstructionsLength: number
  readonly context: InstructionResolverContext
}

export async function assembleSystemMessage(options: AssembleSystemMessageOptions): Promise<SystemMessage> {
  const applicationInstructions = options.systemPrompt?.trim() ?? ''
  let dynamicInstructions = ''

  if (options.resolveInstructions) {
    let resolved: unknown
    try {
      resolved = await awaitWithAbort(
        Promise.resolve().then(() => options.resolveInstructions!(options.context)),
        options.context.signal,
      )
    } catch (error) {
      if (options.context.signal.aborted) throw error
      throw new PromptAssemblyError('INSTRUCTION_RESOLUTION_ERROR', `Failed to resolve instructions: ${errorMessage(error)}`, error)
    }
    if (resolved !== null && resolved !== undefined && typeof resolved !== 'string') {
      throw new PromptAssemblyError('INSTRUCTION_RESOLUTION_ERROR', 'Instruction resolver must return a string, null, or undefined')
    }
    dynamicInstructions = resolved?.trim() ?? ''
  }

  if (applicationInstructions.length + dynamicInstructions.length > options.maxInstructionsLength) {
    throw new PromptAssemblyError('INSTRUCTIONS_TOO_LARGE', `Instructions exceed the maximum length of ${options.maxInstructionsLength}`)
  }

  const sections = [`<karkata_runtime>\n${DEFAULT_SYSTEM_PROMPT}\n</karkata_runtime>`]
  if (applicationInstructions) sections.push(`<application_instructions>\n${applicationInstructions}\n</application_instructions>`)
  if (dynamicInstructions) sections.push(`<dynamic_instructions>\n${dynamicInstructions}\n</dynamic_instructions>`)
  return { role: 'system', content: sections.join('\n\n') }
}

export function createInstructionResolverContext(
  runId: string,
  step: number,
  tools: readonly RegisteredToolInfo[],
  signal: AbortSignal,
): InstructionResolverContext {
  return Object.freeze({ runId, step, tools, signal })
}
