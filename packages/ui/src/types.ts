import type {
  AgentError,
  AgentRequestListener,
  AgentResult,
  AgentStateListener,
  AgentStatus,
  ContextUsage,
} from '@karkata/core'

export interface AgentUIAdapter {
  send(message: string): Promise<AgentResult>
  subscribe(listener: AgentStateListener): () => void
  subscribeRequests(listener: AgentRequestListener): () => void
  respond(requestId: string, answer: string): boolean
  abort(): void
}

export type AgentUIComposer =
  | { readonly mode: 'message' }
  | {
      readonly mode: 'response'
      readonly requestId: string
      readonly callId: string
      readonly prompt: string
    }

export type AgentUISubmitResult =
  | { readonly type: 'message'; readonly result: AgentResult }
  | { readonly type: 'response'; readonly accepted: boolean }

export type AgentUIRunStatus = 'unknown' | 'active' | 'completed' | 'error' | 'aborted'
export type AgentUIContentStatus = 'complete' | 'streaming' | 'incomplete'

export type AgentUIItem =
  | {
      readonly type: 'message'
      readonly id: string
      readonly runId?: string
      readonly runStatus: AgentUIRunStatus
      readonly role: 'user' | 'assistant'
      readonly source: 'conversation' | 'context_snapshot'
      readonly contentStatus: AgentUIContentStatus
      readonly content: string
    }
  | {
      readonly type: 'message'
      readonly id: string
      readonly runId: string
      readonly runStatus: AgentUIRunStatus
      readonly role: 'assistant'
      readonly source: 'human_input'
      readonly interaction: 'question'
      readonly requestId: string
      readonly callId: string
      readonly requestStatus: 'pending' | 'answered' | 'cancelled'
      readonly contentStatus: AgentUIContentStatus
      readonly content: string
    }
  | {
      readonly type: 'message'
      readonly id: string
      readonly runId: string
      readonly runStatus: AgentUIRunStatus
      readonly role: 'user'
      readonly source: 'human_input'
      readonly interaction: 'answer'
      readonly requestId: string
      readonly callId: string
      readonly contentStatus: AgentUIContentStatus
      readonly content: string
    }
  | {
      readonly type: 'tool'
      readonly id: string
      readonly runId?: string
      readonly runStatus: AgentUIRunStatus
      readonly callId: string
      readonly name: string
      readonly status: 'pending' | 'completed' | 'error'
    }

export interface AgentUIState {
  readonly items: readonly AgentUIItem[]
  readonly composer: AgentUIComposer
  readonly historyCompleteness: 'session' | 'context_only'
  readonly status: AgentStatus
  readonly runId?: string
  readonly activeToolName?: string
  readonly result?: AgentResult
  readonly error?: AgentError
  readonly contextUsage?: Readonly<ContextUsage>
  readonly revision: number
}

export interface AgentUIStore {
  getSnapshot(): Readonly<AgentUIState>
  subscribe(listener: () => void): () => void
  submit(input: string): Promise<AgentUISubmitResult>
  abort(): void
  dispose(): void
}
