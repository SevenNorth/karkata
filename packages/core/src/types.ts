import type { z } from 'zod'

export interface SystemMessage { role: 'system'; content: string }
export interface UserMessage { role: 'user'; content: string }
export interface ToolCall { callId: string; name: string; input: unknown }
export interface AssistantMessage {
  role: 'assistant'
  content: string | null
  toolCalls?: readonly ToolCall[]
}
export interface ToolResultMessage {
  role: 'tool'
  callId: string
  name: string
  content: string
  isError: boolean
}
export type AgentMessage = SystemMessage | UserMessage | AssistantMessage | ToolResultMessage

export interface TokenUsage {
  inputTokens?: number | undefined
  outputTokens?: number | undefined
  totalTokens?: number | undefined
}
export interface LLMToolDefinition {
  readonly name: string
  readonly description: string
  readonly inputSchema: z.ZodType
}
export interface LLMRequest {
  readonly messages: readonly AgentMessage[]
  readonly tools: readonly LLMToolDefinition[]
}
export interface LLMResponse { message: AssistantMessage; usage?: TokenUsage }
export interface LLMAdapter {
  invoke(request: LLMRequest, options: { signal: AbortSignal }): Promise<LLMResponse>
}

export interface ContextUsage {
  readonly maxTokens: number
  readonly usedTokens: number
}
export interface ContextEstimationContext {
  readonly runId: string
  readonly step: number
  readonly signal: AbortSignal
}
export type ContextTokenEstimator = (
  request: Readonly<LLMRequest>,
  context: ContextEstimationContext,
) => number | Promise<number>
export interface ContextBudgetConfig {
  readonly maxTokens: number
  readonly estimateTokens: ContextTokenEstimator
}

export type HumanInputConfig = Readonly<Record<string, never>>
export interface HumanInputRequest {
  readonly type: 'human_input'
  readonly id: string
  readonly runId: string
  readonly step: number
  readonly prompt: string
}
export type AgentRequest = HumanInputRequest
export type AgentRequestListener = (request: Readonly<AgentRequest>) => void

export interface ToolContext { signal: AbortSignal; runId: string; step: number }
export type ToolOutput =
  | string
  | number
  | boolean
  | null
  | readonly ToolOutput[]
  | { readonly [key: string]: ToolOutput }
type ValidatedToolOutput<T> =
  T extends string | number | boolean | null ? T
    : T extends (...args: never[]) => unknown ? never
      : T extends readonly unknown[] ? { readonly [K in keyof T]: ValidatedToolOutput<T[K]> }
        : T extends object ? { readonly [K in keyof T]: ValidatedToolOutput<T[K]> }
          : never
type InvalidToolOutput = { readonly __toolOutputMustBeModelVisible: never }
export interface Tool<TInput = unknown, TOutput = unknown> {
  name: string
  description: string
  inputSchema: z.ZodType<TInput>
  execute(input: TInput, context: ToolContext): Promise<TOutput> | TOutput
}
export function defineTool<TInput, TOutput>(
  tool: Tool<TInput, TOutput> & ([TOutput] extends [ToolOutput]
    ? unknown
    : [TOutput] extends [ValidatedToolOutput<TOutput>] ? unknown : InvalidToolOutput),
): Tool<TInput, TOutput> {
  return tool
}

export interface ScopedInitialTool {
  readonly tool: Tool
  readonly scope: string
}
export type InitialTool = Tool | ScopedInitialTool

export interface RegisteredToolInfo {
  readonly name: string
  readonly description: string
  readonly scope: string
}

export interface InstructionResolverContext {
  readonly runId: string
  readonly step: number
  readonly tools: readonly Readonly<RegisteredToolInfo>[]
  readonly signal: AbortSignal
}
export type InstructionResolver = (
  context: InstructionResolverContext,
) => string | null | undefined | Promise<string | null | undefined>

export type AgentStatus = 'idle' | 'running' | 'waiting_for_input' | 'completed' | 'error' | 'aborted' | 'disposed'
export type ModelErrorCode =
  | 'MODEL_NETWORK_ERROR' | 'MODEL_AUTH_ERROR' | 'MODEL_RATE_LIMIT'
  | 'MODEL_INVALID_RESPONSE' | 'MODEL_PROVIDER_ERROR'
export type AgentErrorCode =
  | ModelErrorCode | 'MODEL_ERROR' | 'TOOL_NOT_FOUND' | 'TOOL_CHANGED' | 'TOOL_INVALID_INPUT'
  | 'TOOL_EXECUTION_ERROR' | 'MAX_STEPS_EXCEEDED' | 'TIMEOUT' | 'ABORTED'
  | 'TOOL_RESULT_TOO_LARGE' | 'INSTRUCTION_RESOLUTION_ERROR' | 'INSTRUCTIONS_TOO_LARGE'
  | 'CONTEXT_LIMIT_EXCEEDED' | 'CONTEXT_ESTIMATION_ERROR' | 'INTERNAL_ERROR'

export interface AgentError {
  code: AgentErrorCode
  message: string
  retryable: boolean
  statusCode?: number | undefined
}
export type AgentResult =
  | { status: 'completed'; runId: string; content: string; steps: number }
  | { status: 'aborted'; runId: string; steps: number }
  | { status: 'error'; runId: string; error: AgentError; steps: number }

export interface AgentState {
  status: AgentStatus
  runId?: string | undefined
  step: number
  messages: readonly AgentMessage[]
  activeTool?: { name: string; input: unknown } | undefined
  result?: AgentResult | undefined
  error?: AgentError | undefined
  contextUsage?: Readonly<ContextUsage> | undefined
  updatedAt: number
}
export type AgentStateListener = (state: Readonly<AgentState>) => void

export interface AgentConfig {
  llm: LLMAdapter
  tools?: readonly InitialTool[]
  systemPrompt?: string
  resolveInstructions?: InstructionResolver
  maxInstructionsLength?: number
  contextBudget?: ContextBudgetConfig
  humanInput?: HumanInputConfig
  maxSteps?: number
  timeoutMs?: number
  maxToolResultLength?: number
}
