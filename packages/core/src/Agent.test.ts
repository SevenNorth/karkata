import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { Agent } from './Agent.js'
import { ModelError } from './index.js'
import { ToolRegistry } from './ToolRegistry.js'
import type { InitialTool, LLMAdapter, LLMRequest, LLMResponse, Tool, ToolOutput } from './types.js'

class ScriptedLLM implements LLMAdapter {
  readonly requests: LLMRequest[] = []
  constructor(private readonly responses: LLMResponse[]) {}
  async invoke(request: LLMRequest): Promise<LLMResponse> {
    this.requests.push({ messages: structuredClone(request.messages), tools: request.tools })
    const response = this.responses.shift()
    if (!response) throw new Error('No scripted response')
    return response
  }
}

const message = (content: string): LLMResponse => ({ message: { role: 'assistant', content } })
const toolCall = (callId: string, name: string, input: unknown): LLMResponse => ({ message: { role: 'assistant', content: null, toolCalls: [{ callId, name, input }] } })

describe('Agent', () => {
  it('assembles default, static, and dynamic instructions without exposing them in state history', async () => {
    const llm = new ScriptedLLM([message('done')])
    const resolveInstructions = vi.fn(() => 'Current module: refunds')
    const agent = new Agent({ llm, systemPrompt: 'Reply in Chinese', resolveInstructions })

    await agent.send('help')

    const system = llm.requests[0]!.messages[0]
    expect(system).toMatchObject({ role: 'system' })
    expect(system?.content).toContain('Karkata')
    expect(system?.content).toContain('Reply in Chinese')
    expect(system?.content).toContain('Current module: refunds')
    expect(agent.state.messages.every((item) => item.role !== 'system')).toBe(true)
    expect(agent.state.messages).toEqual([
      { role: 'user', content: 'help' },
      { role: 'assistant', content: 'done' },
    ])
  })

  it('resolves instructions before every model step with a frozen tool snapshot', async () => {
    const tool: Tool = { name: 'lookup', description: 'Lookup', inputSchema: z.object({}), execute: () => 'found' }
    const llm = new ScriptedLLM([toolCall('call-1', 'lookup', {}), message('done')])
    const contexts: unknown[] = []
    const resolveInstructions = vi.fn(async (context) => {
      contexts.push(context)
      return `Step ${context.step}`
    })
    const agent = new Agent({ llm, tools: [{ tool, scope: 'orders' }], resolveInstructions })

    await agent.send('find')

    expect(resolveInstructions).toHaveBeenCalledTimes(2)
    expect(contexts).toEqual([
      expect.objectContaining({ step: 1, tools: [{ name: 'lookup', description: 'Lookup', scope: 'orders' }] }),
      expect.objectContaining({ step: 2, tools: [{ name: 'lookup', description: 'Lookup', scope: 'orders' }] }),
    ])
    const typedContexts = contexts as Array<{ runId: string; signal: AbortSignal; tools: readonly unknown[] }>
    expect(typedContexts[0]!.runId).toBe(typedContexts[1]!.runId)
    expect(typedContexts[0]!.signal).toBe(typedContexts[1]!.signal)
    for (const context of typedContexts) {
      expect(Object.isFrozen(context)).toBe(true)
      expect(Object.isFrozen(context.tools)).toBe(true)
      expect(Object.isFrozen(context.tools[0])).toBe(true)
    }
    expect(llm.requests[0]!.messages[0]).toMatchObject({ role: 'system', content: expect.stringContaining('Step 1') })
    expect(llm.requests[1]!.messages[0]).toMatchObject({ role: 'system', content: expect.stringContaining('Step 2') })
    expect(llm.requests[1]!.messages.filter((item) => item.role === 'system')).toHaveLength(1)
  })

  it('uses the same tool snapshot for instruction resolution and the model request', async () => {
    const oldTool: Tool = { name: 'action', description: 'Old action', inputSchema: z.object({ old: z.string() }), execute: () => 'old' }
    const newTool: Tool = { name: 'action', description: 'New action', inputSchema: z.object({ next: z.string() }), execute: () => 'new' }
    const llm = new ScriptedLLM([message('done')])
    let agent!: Agent
    const resolveInstructions = vi.fn((context) => {
      agent.replaceTool(newTool)
      return `Available: ${context.tools[0]?.description}`
    })
    agent = new Agent({ llm, tools: [oldTool], resolveInstructions })

    await agent.send('act')

    expect(llm.requests[0]!.tools[0]?.description).toBe('Old action')
    expect(llm.requests[0]!.messages[0]).toMatchObject({ role: 'system', content: expect.stringContaining('Available: Old action') })
  })

  it('settles when an instruction resolver ignores cancellation', async () => {
    const llm = new ScriptedLLM([])
    const agent = new Agent({ llm, resolveInstructions: () => new Promise(() => undefined) })

    const run = agent.send('wait')
    await Promise.resolve()
    agent.abort()

    await expect(run).resolves.toMatchObject({ status: 'aborted' })
    expect(llm.requests).toHaveLength(0)
  })

  it('classifies instruction resolver failures and invalid values without calling the model', async () => {
    const failingLLM = new ScriptedLLM([])
    const failingAgent = new Agent({ llm: failingLLM, resolveInstructions: () => { throw new Error('resolver failed') } })
    await expect(failingAgent.send('help')).resolves.toMatchObject({ status: 'error', error: { code: 'INSTRUCTION_RESOLUTION_ERROR' } })
    expect(failingLLM.requests).toHaveLength(0)

    const invalidLLM = new ScriptedLLM([])
    const invalidAgent = new Agent({ llm: invalidLLM, resolveInstructions: (() => 42) as never })
    await expect(invalidAgent.send('help')).resolves.toMatchObject({ status: 'error', error: { code: 'INSTRUCTION_RESOLUTION_ERROR' } })
    expect(invalidLLM.requests).toHaveLength(0)
  })

  it('rejects oversized static or dynamic instructions without calling the model', async () => {
    const staticLLM = new ScriptedLLM([])
    const staticAgent = new Agent({ llm: staticLLM, systemPrompt: '1234', maxInstructionsLength: 3 })
    await expect(staticAgent.send('help')).resolves.toMatchObject({ status: 'error', error: { code: 'INSTRUCTIONS_TOO_LARGE' } })
    expect(staticLLM.requests).toHaveLength(0)

    const dynamicLLM = new ScriptedLLM([])
    const dynamicAgent = new Agent({ llm: dynamicLLM, resolveInstructions: () => '1234', maxInstructionsLength: 3 })
    await expect(dynamicAgent.send('help')).resolves.toMatchObject({ status: 'error', error: { code: 'INSTRUCTIONS_TOO_LARGE' } })
    expect(dynamicLLM.requests).toHaveLength(0)
  })

  it('rejects an invalid instruction length limit during construction', () => {
    expect(() => new Agent({ llm: new ScriptedLLM([]), maxInstructionsLength: -1 })).toThrow('maxInstructionsLength must be a non-negative finite integer')
    expect(() => new Agent({ llm: new ScriptedLLM([]), maxInstructionsLength: Number.POSITIVE_INFINITY })).toThrow('maxInstructionsLength must be a non-negative finite integer')
  })

  it('exposes only the configured maximum and current estimated context usage', () => {
    const agent = new Agent({
      llm: new ScriptedLLM([]),
      contextBudget: { maxTokens: 100, estimateTokens: () => 0 },
    })

    expect(agent.state.contextUsage).toEqual({ maxTokens: 100, usedTokens: 0 })
    expect(Object.keys(agent.state.contextUsage!)).toEqual(['maxTokens', 'usedTokens'])
    expect(new Agent({ llm: new ScriptedLLM([]) }).state.contextUsage).toBeUndefined()
  })

  it('does not freeze adapter requests when context budgeting is disabled', async () => {
    const llm: LLMAdapter = {
      invoke: async (request) => {
        expect(Object.isFrozen(request)).toBe(false)
        expect(Object.isFrozen(request.messages)).toBe(false)
        expect(Object.isFrozen(request.tools)).toBe(false)
        return message('done')
      },
    }

    await new Agent({ llm }).send('unchanged')
  })

  it('estimates the complete model request and allows usage equal to the maximum', async () => {
    const llm = new ScriptedLLM([message('done')])
    const estimateTokens = vi.fn(() => 10)
    const agent = new Agent({
      llm,
      systemPrompt: 'Application rules',
      tools: [{ name: 'lookup', description: 'Lookup', inputSchema: z.object({ id: z.string() }), execute: () => 'found' }],
      contextBudget: { maxTokens: 10, estimateTokens },
    })

    await expect(agent.send('find')).resolves.toMatchObject({ status: 'completed', content: 'done' })

    expect(estimateTokens).toHaveBeenCalledOnce()
    const [estimatedRequest, context] = estimateTokens.mock.calls[0]!
    expect(estimatedRequest.messages).toEqual(llm.requests[0]!.messages)
    expect(estimatedRequest.tools).toEqual(llm.requests[0]!.tools)
    expect(estimatedRequest.messages[0]).toMatchObject({ role: 'system', content: expect.stringContaining('Application rules') })
    expect(context).toMatchObject({ runId: expect.any(String), step: 1, signal: expect.any(AbortSignal) })
    expect(Object.isFrozen(estimatedRequest)).toBe(true)
    expect(Object.isFrozen(estimatedRequest.messages)).toBe(true)
    expect(Object.isFrozen(estimatedRequest.messages[0])).toBe(true)
    expect(Object.isFrozen(estimatedRequest.tools)).toBe(true)
    expect(Object.isFrozen(estimatedRequest.tools[0])).toBe(true)
    expect(Object.isFrozen(context)).toBe(true)
    expect(agent.state.contextUsage).toEqual({ maxTokens: 10, usedTokens: 10 })
  })

  it('preserves the latest estimate when the model call fails', async () => {
    const agent = new Agent({
      llm: { invoke: () => Promise.reject(new Error('model failed')) },
      contextBudget: { maxTokens: 20, estimateTokens: () => 6 },
    })

    await expect(agent.send('fail')).resolves.toMatchObject({ status: 'error', error: { code: 'MODEL_ERROR' } })

    expect(agent.state.contextUsage).toEqual({ maxTokens: 20, usedTokens: 6 })
    expect(agent.state.messages).toEqual([])
  })

  it('blocks an over-budget request without calling the model or committing the run', async () => {
    const llm = new ScriptedLLM([])
    const agent = new Agent({
      llm,
      contextBudget: { maxTokens: 10, estimateTokens: () => 11 },
    })

    await expect(agent.send('too large')).resolves.toMatchObject({
      status: 'error',
      error: { code: 'CONTEXT_LIMIT_EXCEEDED', retryable: false },
    })
    expect(llm.requests).toHaveLength(0)
    expect(agent.state.contextUsage).toEqual({ maxTokens: 10, usedTokens: 11 })
    expect(agent.state.messages).toEqual([])
  })

  it('re-estimates context after tool results expand a multi-step run', async () => {
    const llm = new ScriptedLLM([toolCall('call-1', 'lookup', {}), message('done')])
    const estimateTokens = vi.fn()
      .mockReturnValueOnce(8)
      .mockReturnValueOnce(14)
    const agent = new Agent({
      llm,
      tools: [{ name: 'lookup', description: 'Lookup', inputSchema: z.object({}), execute: () => ({ result: 'expanded context' }) }],
      contextBudget: { maxTokens: 20, estimateTokens },
    })

    await agent.send('find')

    expect(estimateTokens).toHaveBeenCalledTimes(2)
    expect(estimateTokens.mock.calls[1]![0].messages).toEqual(llm.requests[1]!.messages)
    expect(estimateTokens.mock.calls[1]![0].messages.at(-1)).toMatchObject({ role: 'tool', content: expect.stringContaining('expanded context') })
    expect(agent.state.contextUsage).toEqual({ maxTokens: 20, usedTokens: 14 })
  })

  it('compacts frozen committed history above the trigger and re-estimates the candidate request', async () => {
    const llm = new ScriptedLLM([message('first answer'), message('second answer')])
    const estimateTokens = vi.fn()
      .mockReturnValueOnce(4)
      .mockReturnValueOnce(12)
      .mockReturnValueOnce(6)
    const compactHistory = vi.fn(() => [{ role: 'user' as const, content: 'Previous conversation summary' }])
    const agent = new Agent({
      llm,
      contextBudget: {
        maxTokens: 20,
        estimateTokens,
        compaction: { triggerTokens: 10, targetTokens: 7, compactHistory },
      },
    })

    await agent.send('first question')
    await expect(agent.send('second question')).resolves.toMatchObject({ status: 'completed' })

    expect(compactHistory).toHaveBeenCalledOnce()
    const [history, context] = compactHistory.mock.calls[0]!
    expect(history).toEqual([
      { role: 'user', content: 'first question' },
      { role: 'assistant', content: 'first answer' },
    ])
    expect(Object.isFrozen(history)).toBe(true)
    expect(Object.isFrozen(history[0])).toBe(true)
    expect(context).toMatchObject({
      runId: expect.any(String),
      step: 1,
      signal: expect.any(AbortSignal),
      usedTokens: 12,
      targetTokens: 7,
      maxTokens: 20,
    })
    expect(Object.isFrozen(context)).toBe(true)
    expect(estimateTokens).toHaveBeenCalledTimes(3)
    expect(llm.requests[1]!.messages).toEqual([
      expect.objectContaining({ role: 'system' }),
      { role: 'user', content: 'Previous conversation summary' },
      { role: 'user', content: 'second question' },
    ])
    expect(agent.state.contextUsage).toEqual({ maxTokens: 20, usedTokens: 6 })
  })

  it('does not compact when context usage equals the trigger', async () => {
    const compactHistory = vi.fn(() => [])
    const llm = new ScriptedLLM([message('done')])
    const agent = new Agent({
      llm,
      contextBudget: {
        maxTokens: 20,
        estimateTokens: () => 10,
        compaction: { triggerTokens: 10, targetTokens: 5, compactHistory },
      },
    })

    await expect(agent.send('within threshold')).resolves.toMatchObject({ status: 'completed' })

    expect(compactHistory).not.toHaveBeenCalled()
    expect(llm.requests).toHaveLength(1)
  })

  it('returns a safe compaction error when the compactor throws', async () => {
    const llm = new ScriptedLLM([message('first answer')])
    const estimateTokens = vi.fn()
      .mockReturnValueOnce(4)
      .mockReturnValueOnce(12)
    const agent = new Agent({
      llm,
      contextBudget: {
        maxTokens: 20,
        estimateTokens,
        compaction: {
          triggerTokens: 10,
          targetTokens: 7,
          compactHistory: () => { throw new Error('Authorization: Bearer compactor-secret') },
        },
      },
    })
    await agent.send('first question')

    await expect(agent.send('second question')).resolves.toMatchObject({
      status: 'error',
      error: { code: 'CONTEXT_COMPACTION_ERROR', message: 'Context compaction failed', retryable: false },
    })
    expect(llm.requests).toHaveLength(1)
    expect(agent.state.messages).toEqual([
      { role: 'user', content: 'first question' },
      { role: 'assistant', content: 'first answer' },
    ])
    expect(JSON.stringify(agent.state)).not.toContain('compactor-secret')
  })

  it.each([
    ['a non-array result', null],
    ['an invalid message value', [null]],
    ['an empty text message', [{ role: 'user', content: '   ' }]],
    ['an empty assistant message', [{ role: 'assistant', content: null }]],
    ['an assistant with invalid content', [{ role: 'assistant', content: 42 }]],
    ['an assistant with invalid tool calls', [{ role: 'assistant', content: 'answer', toolCalls: 'invalid' }]],
    ['an invalid tool call', [{ role: 'assistant', content: null, toolCalls: [{ callId: '', name: 'lookup', input: {} }] }]],
    ['an unmatched tool result', [{ role: 'tool', callId: 'missing', name: 'lookup', content: 'result', isError: false }]],
    ['an invalid tool result', [
      { role: 'assistant', content: null, toolCalls: [{ callId: 'call-1', name: 'lookup', input: {} }] },
      { role: 'tool', callId: 'call-1', name: 'lookup', content: 42, isError: false },
    ]],
    ['an unresolved tool call', [{ role: 'assistant', content: null, toolCalls: [{ callId: 'call-1', name: 'lookup', input: {} }] }]],
    ['a message before a pending tool result', [
      { role: 'assistant', content: null, toolCalls: [{ callId: 'call-1', name: 'lookup', input: {} }] },
      { role: 'user', content: 'continue' },
    ]],
    ['a mismatched tool result name', [
      { role: 'assistant', content: null, toolCalls: [{ callId: 'call-1', name: 'lookup', input: {} }] },
      { role: 'tool', callId: 'call-1', name: 'other', content: 'result', isError: false },
    ]],
    ['a duplicate tool call ID', [
      { role: 'assistant', content: null, toolCalls: [
        { callId: 'call-1', name: 'lookup', input: {} },
        { callId: 'call-1', name: 'other', input: {} },
      ] },
      { role: 'tool', callId: 'call-1', name: 'lookup', content: 'result', isError: false },
    ]],
    ['an unsupported message role', [{ role: 'developer', content: 'invalid' }]],
  ])('rejects %s from the compactor before invoking the model', async (_label, candidate) => {
    const llm = new ScriptedLLM([message('first answer')])
    const estimateTokens = vi.fn()
      .mockReturnValueOnce(4)
      .mockReturnValueOnce(12)
    const agent = new Agent({
      llm,
      contextBudget: {
        maxTokens: 20,
        estimateTokens,
        compaction: {
          triggerTokens: 10,
          targetTokens: 7,
          compactHistory: () => candidate as never,
        },
      },
    })
    await agent.send('first question')

    await expect(agent.send('second question')).resolves.toMatchObject({
      status: 'error',
      error: { code: 'CONTEXT_COMPACTION_ERROR', message: 'Context compaction failed', retryable: false },
    })
    expect(llm.requests).toHaveLength(1)
    expect(estimateTokens).toHaveBeenCalledTimes(2)
  })

  it('rejects a valid candidate that does not reach the target budget', async () => {
    const llm = new ScriptedLLM([message('first answer')])
    const estimateTokens = vi.fn()
      .mockReturnValueOnce(4)
      .mockReturnValueOnce(12)
      .mockReturnValueOnce(8)
    const agent = new Agent({
      llm,
      contextBudget: {
        maxTokens: 20,
        estimateTokens,
        compaction: {
          triggerTokens: 10,
          targetTokens: 7,
          compactHistory: () => [{ role: 'user', content: 'Still too large' }],
        },
      },
    })
    await agent.send('first question')

    await expect(agent.send('second question')).resolves.toMatchObject({
      status: 'error',
      error: { code: 'CONTEXT_COMPACTION_ERROR', message: 'Context compaction failed', retryable: false },
    })
    expect(llm.requests).toHaveLength(1)
    expect(agent.state.contextUsage).toEqual({ maxTokens: 20, usedTokens: 8 })
  })

  it('does not compact current run messages when there is no committed history', async () => {
    const compactHistory = vi.fn(() => [])
    const llm = new ScriptedLLM([message('done')])
    const agent = new Agent({
      llm,
      contextBudget: {
        maxTokens: 20,
        estimateTokens: () => 15,
        compaction: { triggerTokens: 10, targetTokens: 7, compactHistory },
      },
    })

    await expect(agent.send('large current request')).resolves.toMatchObject({ status: 'completed' })

    expect(compactHistory).not.toHaveBeenCalled()
    expect(llm.requests).toHaveLength(1)
  })

  it('uses staged compacted history throughout a multi-step run and commits it on success', async () => {
    const llm = new ScriptedLLM([
      message('first answer'),
      toolCall('call-1', 'lookup', {}),
      message('second answer'),
      message('third answer'),
    ])
    const estimateTokens = vi.fn()
      .mockReturnValueOnce(4)
      .mockReturnValueOnce(12)
      .mockReturnValueOnce(6)
      .mockReturnValueOnce(9)
      .mockReturnValueOnce(9)
    const compactHistory = vi.fn(() => [{ role: 'user' as const, content: 'Previous conversation summary' }])
    const agent = new Agent({
      llm,
      tools: [{ name: 'lookup', description: 'Lookup', inputSchema: z.object({}), execute: () => 'found' }],
      contextBudget: {
        maxTokens: 20,
        estimateTokens,
        compaction: { triggerTokens: 10, targetTokens: 7, compactHistory },
      },
    })
    await agent.send('first question')

    await expect(agent.send('second question')).resolves.toMatchObject({ status: 'completed' })

    expect(compactHistory).toHaveBeenCalledOnce()
    expect(llm.requests[1]!.messages).toContainEqual({ role: 'user', content: 'Previous conversation summary' })
    expect(llm.requests[2]!.messages).toContainEqual({ role: 'user', content: 'Previous conversation summary' })
    expect(llm.requests[2]!.messages.at(-1)).toMatchObject({ role: 'tool', callId: 'call-1', content: 'found' })
    expect(agent.state.messages).toEqual([
      { role: 'user', content: 'Previous conversation summary' },
      { role: 'user', content: 'second question' },
      expect.objectContaining({ role: 'assistant', toolCalls: [expect.objectContaining({ callId: 'call-1' })] }),
      expect.objectContaining({ role: 'tool', callId: 'call-1' }),
      { role: 'assistant', content: 'second answer' },
    ])

    await agent.send('third question')
    expect(llm.requests[3]!.messages).not.toContainEqual({ role: 'user', content: 'first question' })
    expect(llm.requests[3]!.messages).toContainEqual({ role: 'user', content: 'Previous conversation summary' })
  })

  it('rolls back staged compacted history when the model fails', async () => {
    const invoke = vi.fn()
      .mockResolvedValueOnce(message('first answer'))
      .mockRejectedValueOnce(new Error('model failed'))
    const estimateTokens = vi.fn()
      .mockReturnValueOnce(4)
      .mockReturnValueOnce(12)
      .mockReturnValueOnce(6)
    const agent = new Agent({
      llm: { invoke },
      contextBudget: {
        maxTokens: 20,
        estimateTokens,
        compaction: {
          triggerTokens: 10,
          targetTokens: 7,
          compactHistory: () => [{ role: 'user', content: 'Previous conversation summary' }],
        },
      },
    })
    await agent.send('first question')

    await expect(agent.send('second question')).resolves.toMatchObject({ status: 'error', error: { code: 'MODEL_ERROR' } })

    expect(agent.state.messages).toEqual([
      { role: 'user', content: 'first question' },
      { role: 'assistant', content: 'first answer' },
    ])
  })

  it('rolls back staged compacted history when candidate estimation fails', async () => {
    const llm = new ScriptedLLM([message('first answer')])
    const estimateTokens = vi.fn()
      .mockReturnValueOnce(4)
      .mockReturnValueOnce(12)
      .mockImplementationOnce(() => { throw new Error('candidate estimate failed') })
    const agent = new Agent({
      llm,
      contextBudget: {
        maxTokens: 20,
        estimateTokens,
        compaction: {
          triggerTokens: 10,
          targetTokens: 7,
          compactHistory: () => [{ role: 'user', content: 'Previous conversation summary' }],
        },
      },
    })
    await agent.send('first question')

    await expect(agent.send('second question')).resolves.toMatchObject({
      status: 'error',
      error: { code: 'CONTEXT_ESTIMATION_ERROR' },
    })

    expect(llm.requests).toHaveLength(1)
    expect(agent.state.messages).toEqual([
      { role: 'user', content: 'first question' },
      { role: 'assistant', content: 'first answer' },
    ])
  })

  it('settles and ignores a compaction result that arrives after cancellation', async () => {
    let resolveCompaction!: (history: readonly LLMRequest['messages'][number][]) => void
    let notifyStarted!: () => void
    const started = new Promise<void>((resolve) => { notifyStarted = resolve })
    const llm = new ScriptedLLM([message('first answer')])
    const estimateTokens = vi.fn()
      .mockReturnValueOnce(4)
      .mockReturnValueOnce(12)
    const agent = new Agent({
      llm,
      contextBudget: {
        maxTokens: 20,
        estimateTokens,
        compaction: {
          triggerTokens: 10,
          targetTokens: 7,
          compactHistory: () => new Promise((resolve) => { resolveCompaction = resolve; notifyStarted() }),
        },
      },
    })
    await agent.send('first question')
    const run = agent.send('second question')
    await started

    agent.abort()
    await expect(run).resolves.toMatchObject({ status: 'aborted' })
    resolveCompaction([{ role: 'user', content: 'Late summary' }])
    await Promise.resolve()

    expect(llm.requests).toHaveLength(1)
    expect(agent.state.messages).toEqual([
      { role: 'user', content: 'first question' },
      { role: 'assistant', content: 'first answer' },
    ])
    expect(agent.state.contextUsage).toEqual({ maxTokens: 20, usedTokens: 12 })
  })

  it('times out while a compactor ignores its signal', async () => {
    vi.useFakeTimers()
    try {
      let notifyStarted!: () => void
      const started = new Promise<void>((resolve) => { notifyStarted = resolve })
      const llm = new ScriptedLLM([message('first answer')])
      const estimateTokens = vi.fn()
        .mockReturnValueOnce(4)
        .mockReturnValueOnce(12)
      const agent = new Agent({
        llm,
        timeoutMs: 50,
        contextBudget: {
          maxTokens: 20,
          estimateTokens,
          compaction: {
            triggerTokens: 10,
            targetTokens: 7,
            compactHistory: () => { notifyStarted(); return new Promise(() => undefined) },
          },
        },
      })
      await agent.send('first question')
      const run = agent.send('second question')
      await started

      await vi.advanceTimersByTimeAsync(50)

      await expect(run).resolves.toMatchObject({ status: 'error', error: { code: 'TIMEOUT' } })
      expect(llm.requests).toHaveLength(1)
      expect(agent.state.messages).toEqual([
        { role: 'user', content: 'first question' },
        { role: 'assistant', content: 'first answer' },
      ])
    } finally {
      vi.useRealTimers()
    }
  })

  it('disposes while a compactor ignores its signal and isolates the late candidate', async () => {
    let resolveCompaction!: (history: readonly LLMRequest['messages'][number][]) => void
    let notifyStarted!: () => void
    const started = new Promise<void>((resolve) => { notifyStarted = resolve })
    const llm = new ScriptedLLM([message('first answer')])
    const estimateTokens = vi.fn()
      .mockReturnValueOnce(4)
      .mockReturnValueOnce(12)
    const agent = new Agent({
      llm,
      contextBudget: {
        maxTokens: 20,
        estimateTokens,
        compaction: {
          triggerTokens: 10,
          targetTokens: 7,
          compactHistory: () => new Promise((resolve) => { resolveCompaction = resolve; notifyStarted() }),
        },
      },
    })
    await agent.send('first question')
    const run = agent.send('second question')
    await started

    await agent.dispose()
    await expect(run).resolves.toMatchObject({ status: 'aborted' })
    resolveCompaction([{ role: 'user', content: 'Late summary' }])
    await Promise.resolve()

    expect(agent.state).toMatchObject({ status: 'disposed', messages: [] })
    expect(llm.requests).toHaveLength(1)
  })

  it('supports deterministic trimming by retaining only recent complete turns', async () => {
    const llm = new ScriptedLLM([message('first answer'), message('second answer'), message('third answer')])
    const estimateTokens = vi.fn()
      .mockReturnValueOnce(4)
      .mockReturnValueOnce(8)
      .mockReturnValueOnce(12)
      .mockReturnValueOnce(6)
    const compactHistory = vi.fn((history: readonly LLMRequest['messages'][number][]) => history.slice(-2))
    const agent = new Agent({
      llm,
      contextBudget: {
        maxTokens: 20,
        estimateTokens,
        compaction: { triggerTokens: 10, targetTokens: 7, compactHistory },
      },
    })
    await agent.send('first question')
    await agent.send('second question')

    await expect(agent.send('third question')).resolves.toMatchObject({ status: 'completed' })

    expect(compactHistory).toHaveBeenCalledOnce()
    expect(llm.requests[2]!.messages).not.toContainEqual({ role: 'user', content: 'first question' })
    expect(llm.requests[2]!.messages).toContainEqual({ role: 'user', content: 'second question' })
    expect(agent.state.messages).toEqual([
      { role: 'user', content: 'second question' },
      { role: 'assistant', content: 'second answer' },
      { role: 'user', content: 'third question' },
      { role: 'assistant', content: 'third answer' },
    ])
  })

  it('rejects invalid context budget configuration', () => {
    const llm = new ScriptedLLM([])

    expect(() => new Agent({ llm, contextBudget: { maxTokens: 0, estimateTokens: () => 0 } })).toThrow('maxTokens must be a positive finite integer')
    expect(() => new Agent({ llm, contextBudget: { maxTokens: 1.5, estimateTokens: () => 0 } })).toThrow('maxTokens must be a positive finite integer')
    expect(() => new Agent({ llm, contextBudget: { maxTokens: 10, estimateTokens: undefined as never } })).toThrow('estimateTokens must be a function')
  })

  it('rejects invalid context compaction configuration', () => {
    const llm = new ScriptedLLM([])
    const compactHistory = () => []
    const contextBudget = { maxTokens: 10, estimateTokens: () => 0 }

    expect(() => new Agent({ llm, contextBudget: { ...contextBudget, compaction: null as never } })).toThrow('compaction must be a configuration object')
    expect(() => new Agent({ llm, contextBudget: { ...contextBudget, compaction: { triggerTokens: 0, targetTokens: 1, compactHistory } } })).toThrow('triggerTokens must be a positive finite integer')
    expect(() => new Agent({ llm, contextBudget: { ...contextBudget, compaction: { triggerTokens: 11, targetTokens: 1, compactHistory } } })).toThrow('triggerTokens must not exceed maxTokens')
    expect(() => new Agent({ llm, contextBudget: { ...contextBudget, compaction: { triggerTokens: 8, targetTokens: 0, compactHistory } } })).toThrow('targetTokens must be a positive finite integer')
    expect(() => new Agent({ llm, contextBudget: { ...contextBudget, compaction: { triggerTokens: 8, targetTokens: 8, compactHistory } } })).toThrow('targetTokens must be less than triggerTokens')
    expect(() => new Agent({ llm, contextBudget: { ...contextBudget, compaction: { triggerTokens: 8, targetTokens: 4, compactHistory: undefined as never } } })).toThrow('compactHistory must be a function')
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1, 1.5])('reports an invalid token estimate %s without calling the model', async (estimate) => {
    const llm = new ScriptedLLM([])
    const agent = new Agent({ llm, contextBudget: { maxTokens: 10, estimateTokens: () => estimate } })

    await expect(agent.send('estimate')).resolves.toMatchObject({
      status: 'error',
      error: { code: 'CONTEXT_ESTIMATION_ERROR', message: 'Context token estimation failed', retryable: false },
    })
    expect(llm.requests).toHaveLength(0)
    expect(agent.state.contextUsage).toEqual({ maxTokens: 10, usedTokens: 0 })
  })

  it('does not expose an estimator failure or call the model', async () => {
    const llm = new ScriptedLLM([])
    const agent = new Agent({
      llm,
      contextBudget: {
        maxTokens: 10,
        estimateTokens: () => { throw new Error('Authorization: Bearer estimator-secret') },
      },
    })

    await expect(agent.send('estimate')).resolves.toMatchObject({
      status: 'error',
      error: { code: 'CONTEXT_ESTIMATION_ERROR', message: 'Context token estimation failed', retryable: false },
    })
    expect(llm.requests).toHaveLength(0)
    expect(JSON.stringify(agent.state)).not.toContain('estimator-secret')
  })

  it('settles when a context estimator ignores manual cancellation', async () => {
    const llm = new ScriptedLLM([])
    const agent = new Agent({
      llm,
      contextBudget: { maxTokens: 10, estimateTokens: () => new Promise(() => undefined) },
    })
    const run = agent.send('wait')
    await Promise.resolve()

    agent.abort()

    await expect(run).resolves.toMatchObject({ status: 'aborted' })
    expect(llm.requests).toHaveLength(0)
  })

  it('times out when a context estimator ignores its signal', async () => {
    vi.useFakeTimers()
    const llm = new ScriptedLLM([])
    const agent = new Agent({
      llm,
      timeoutMs: 50,
      contextBudget: { maxTokens: 10, estimateTokens: () => new Promise(() => undefined) },
    })
    const run = agent.send('wait')

    await vi.advanceTimersByTimeAsync(50)

    await expect(run).resolves.toMatchObject({ status: 'error', error: { code: 'TIMEOUT' } })
    expect(llm.requests).toHaveLength(0)
    vi.useRealTimers()
  })

  it('ignores an estimate that arrives after cancellation', async () => {
    let resolveEstimate!: (tokens: number) => void
    const llm = new ScriptedLLM([])
    const agent = new Agent({
      llm,
      contextBudget: {
        maxTokens: 10,
        estimateTokens: () => new Promise((resolve) => { resolveEstimate = resolve }),
      },
    })
    const run = agent.send('cancel')
    await Promise.resolve()

    agent.abort()
    await expect(run).resolves.toMatchObject({ status: 'aborted' })
    resolveEstimate(9)
    await Promise.resolve()

    expect(agent.state.contextUsage).toEqual({ maxTokens: 10, usedTokens: 0 })
    expect(llm.requests).toHaveLength(0)
  })

  it('does not accumulate provider usage and resets context usage when history is cleared', async () => {
    const llm = new ScriptedLLM([
      { message: { role: 'assistant', content: 'first' }, usage: { inputTokens: 999, totalTokens: 1_000 } },
      message('second'),
    ])
    const estimateTokens = vi.fn()
      .mockReturnValueOnce(7)
      .mockReturnValueOnce(9)
    const agent = new Agent({ llm, contextBudget: { maxTokens: 20, estimateTokens } })

    await agent.send('one')
    expect(agent.state.contextUsage).toEqual({ maxTokens: 20, usedTokens: 7 })
    await agent.send('two')
    expect(agent.state.contextUsage).toEqual({ maxTokens: 20, usedTokens: 9 })

    agent.clearHistory()

    expect(agent.state.contextUsage).toEqual({ maxTokens: 20, usedTokens: 0 })
  })

  it('publishes detached context usage snapshots', async () => {
    const agent = new Agent({
      llm: new ScriptedLLM([message('done')]),
      contextBudget: { maxTokens: 20, estimateTokens: () => 5 },
    })
    const before = agent.state.contextUsage!

    await agent.send('update')

    expect(before).toEqual({ maxTokens: 20, usedTokens: 0 })
    expect(agent.state.contextUsage).toEqual({ maxTokens: 20, usedTokens: 5 })
    expect(agent.state.contextUsage).not.toBe(before)
  })

  it('does not inject the human input tool unless the capability is enabled', async () => {
    const llm = new ScriptedLLM([message('done')])
    const agent = new Agent({ llm })

    await agent.send('continue')

    expect(llm.requests[0]!.tools).toEqual([])
  })

  it.each([null, [], { unexpected: true }])('rejects invalid human input configuration %#', (humanInput) => {
    expect(() => new Agent({
      llm: new ScriptedLLM([]),
      humanInput: humanInput as never,
    })).toThrow('humanInput must be an empty configuration object')
  })

  it('publishes a frozen human input request and resumes the same run after a response', async () => {
    const llm = new ScriptedLLM([
      toolCall('call-1', 'ask_user', { question: 'Which account should I use?' }),
      message('done'),
    ])
    const agent = new Agent({ llm, humanInput: {} })
    const requests: unknown[] = []
    let resolveRequest!: () => void
    const requestPublished = new Promise<void>((resolve) => { resolveRequest = resolve })
    agent.subscribeRequests((request) => {
      requests.push(request)
      resolveRequest()
    })

    const run = agent.send('make a payment')
    await requestPublished

    expect(llm.requests[0]!.tools.map(({ name }) => name)).toEqual(['ask_user'])
    expect(agent.state).toMatchObject({ status: 'waiting_for_input', step: 1 })
    expect(requests).toHaveLength(1)
    const request = requests[0] as { id: string; type: string; callId: string; runId: string; step: number; prompt: string }
    expect(request).toEqual({
      type: 'human_input',
      id: expect.any(String),
      callId: 'call-1',
      runId: agent.state.runId,
      step: 1,
      prompt: 'Which account should I use?',
    })
    expect(Object.isFrozen(request)).toBe(true)

    expect(agent.respond(request.id, 'Savings')).toBe(true)
    await expect(run).resolves.toMatchObject({ status: 'completed', content: 'done' })
    expect(llm.requests[1]!.messages.at(-1)).toEqual({
      role: 'tool',
      callId: 'call-1',
      name: 'ask_user',
      content: '{"answer":"Savings"}',
      isError: false,
    })
  })

  it('replays the pending request to late subscribers and isolates request listener errors', async () => {
    const llm = new ScriptedLLM([
      toolCall('call-1', 'ask_user', { question: 'Continue?' }),
      message('done'),
    ])
    const agent = new Agent({ llm, humanInput: {} })
    let pendingId = ''
    const requestPublished = new Promise<void>((resolve) => {
      agent.subscribeRequests((request) => {
        pendingId = request.id
        resolve()
      })
    })
    agent.subscribeRequests(() => { throw new Error('UI failed') })
    const run = agent.send('start')
    await requestPublished

    const lateListener = vi.fn()
    agent.subscribeRequests(lateListener)

    expect(lateListener).toHaveBeenCalledOnce()
    expect(lateListener).toHaveBeenCalledWith(expect.objectContaining({ id: pendingId, prompt: 'Continue?' }))
    expect(agent.respond(pendingId, 'Yes')).toBe(true)
    await expect(run).resolves.toMatchObject({ status: 'completed' })
  })

  it('reports invalid ask_user input as a tool error without publishing a request', async () => {
    const llm = new ScriptedLLM([
      toolCall('call-1', 'ask_user', { question: '   ' }),
      message('recovered'),
    ])
    const agent = new Agent({ llm, humanInput: {} })
    const listener = vi.fn()
    agent.subscribeRequests(listener)

    await expect(agent.send('start')).resolves.toMatchObject({ status: 'completed', content: 'recovered' })

    expect(listener).not.toHaveBeenCalled()
    expect(llm.requests[1]!.messages.at(-1)).toMatchObject({
      role: 'tool',
      callId: 'call-1',
      name: 'ask_user',
      isError: true,
      content: expect.stringContaining('TOOL_INVALID_INPUT'),
    })
  })

  it('validates responses and accepts only the current request once', async () => {
    const llm = new ScriptedLLM([
      toolCall('call-1', 'ask_user', { question: 'Continue?' }),
      message('done'),
    ])
    const agent = new Agent({ llm, humanInput: {} })
    let pendingId = ''
    const requestPublished = new Promise<void>((resolve) => {
      agent.subscribeRequests((request) => { pendingId = request.id; resolve() })
    })
    const run = agent.send('start')
    await requestPublished

    expect(() => agent.respond(pendingId, '   ')).toThrow('answer must not be empty')
    expect(() => agent.respond(pendingId, 42 as never)).toThrow('answer must not be empty')
    expect(agent.respond('wrong-id', 'Yes')).toBe(false)
    expect(agent.state.status).toBe('waiting_for_input')
    expect(agent.respond(pendingId, 'Yes')).toBe(true)
    expect(agent.respond(pendingId, 'Again')).toBe(false)

    await expect(run).resolves.toMatchObject({ status: 'completed' })
    expect(agent.respond(pendingId, 'Too late')).toBe(false)
    expect(agent.respond('missing', 'No request')).toBe(false)
  })

  it('waits for multiple human input calls in their original order', async () => {
    const llm = new ScriptedLLM([
      {
        message: {
          role: 'assistant',
          content: null,
          toolCalls: [
            { callId: 'call-1', name: 'ask_user', input: { question: 'First?' } },
            { callId: 'call-2', name: 'ask_user', input: { question: 'Second?' } },
          ],
        },
      },
      message('done'),
    ])
    const agent = new Agent({ llm, humanInput: {} })
    const requests: Array<{ callId: string; prompt: string }> = []
    agent.subscribeRequests((request) => {
      requests.push({ callId: request.callId, prompt: request.prompt })
      expect(agent.respond(request.id, requests.length === 1 ? 'One' : 'Two')).toBe(true)
    })

    await expect(agent.send('ask twice')).resolves.toMatchObject({ status: 'completed' })

    expect(requests).toEqual([
      { callId: 'call-1', prompt: 'First?' },
      { callId: 'call-2', prompt: 'Second?' },
    ])
    expect(llm.requests[1]!.messages.slice(-2)).toEqual([
      { role: 'tool', callId: 'call-1', name: 'ask_user', content: '{"answer":"One"}', isError: false },
      { role: 'tool', callId: 'call-2', name: 'ask_user', content: '{"answer":"Two"}', isError: false },
    ])
  })

  it('applies the tool result length limit to human input answers', async () => {
    const llm = new ScriptedLLM([
      toolCall('call-1', 'ask_user', { question: 'Details?' }),
      message('done'),
    ])
    const agent = new Agent({ llm, humanInput: {}, maxToolResultLength: 10 })
    agent.subscribeRequests((request) => { agent.respond(request.id, 'a long answer') })

    await agent.send('start')

    expect(llm.requests[1]!.messages.at(-1)).toMatchObject({
      role: 'tool',
      callId: 'call-1',
      content: '{"answer":\n[truncated]',
      isError: false,
    })
  })

  it('reserves ask_user only while human input is enabled', async () => {
    const askUser: Tool = { name: 'ask_user', description: 'Custom ask', inputSchema: z.object({}), execute: () => 'custom' }

    expect(() => new Agent({ llm: new ScriptedLLM([]), humanInput: {}, tools: [askUser] })).toThrow('Tool name is reserved while human input is enabled: ask_user')

    const enabled = new Agent({ llm: new ScriptedLLM([]), humanInput: {} })
    expect(() => enabled.registerTool(askUser)).toThrow('Tool name is reserved while human input is enabled: ask_user')
    expect(() => enabled.replaceTool(askUser)).toThrow('Tool name is reserved while human input is enabled: ask_user')
    expect(() => enabled.replaceToolScope('custom', [askUser])).toThrow('Tool name is reserved while human input is enabled: ask_user')

    const llm = new ScriptedLLM([toolCall('call-1', 'ask_user', {}), message('done')])
    const disabled = new Agent({ llm, tools: [askUser] })
    await expect(disabled.send('custom')).resolves.toMatchObject({ status: 'completed' })
    expect(llm.requests[1]!.messages.at(-1)).toMatchObject({ name: 'ask_user', content: 'custom', isError: false })
  })

  it('commits paired human input messages only when the run completes', async () => {
    const successLLM = new ScriptedLLM([
      toolCall('call-1', 'ask_user', { question: 'Continue?' }),
      message('done'),
    ])
    const successAgent = new Agent({ llm: successLLM, humanInput: {} })
    successAgent.subscribeRequests((request) => { successAgent.respond(request.id, 'Yes') })
    await successAgent.send('start')
    expect(successAgent.state.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'assistant', toolCalls: [expect.objectContaining({ callId: 'call-1' })] }),
      expect.objectContaining({ role: 'tool', callId: 'call-1', isError: false }),
    ]))

    const failingAgent = new Agent({
      llm: {
        invoke: vi.fn()
          .mockResolvedValueOnce(toolCall('call-2', 'ask_user', { question: 'Continue?' }))
          .mockRejectedValueOnce(new Error('model failed')),
      },
      humanInput: {},
    })
    failingAgent.subscribeRequests((request) => { failingAgent.respond(request.id, 'Yes') })
    await expect(failingAgent.send('start')).resolves.toMatchObject({ status: 'error', error: { code: 'MODEL_ERROR' } })
    expect(failingAgent.state.messages).toEqual([])
  })

  it('remains busy while waiting for human input', async () => {
    const agent = new Agent({
      llm: new ScriptedLLM([toolCall('call-1', 'ask_user', { question: 'Wait?' })]),
      humanInput: {},
    })
    let pendingId = ''
    const requestPublished = new Promise<void>((resolve) => {
      agent.subscribeRequests((request) => { pendingId = request.id; resolve() })
    })
    const run = agent.send('start')
    await requestPublished

    await expect(agent.send('another')).rejects.toThrow('already active')
    expect(() => agent.clearHistory()).toThrow('Cannot clear history while running')

    agent.abort()
    await expect(run).resolves.toMatchObject({ status: 'aborted' })
    expect(agent.respond(pendingId, 'Late')).toBe(false)
  })

  it('aborts a pending human input request and isolates a late response', async () => {
    const llm = new ScriptedLLM([toolCall('call-1', 'ask_user', { question: 'Wait?' })])
    const agent = new Agent({ llm, humanInput: {} })
    let requestId = ''
    const requestPublished = new Promise<void>((resolve) => {
      agent.subscribeRequests((request) => { requestId = request.id; resolve() })
    })
    const run = agent.send('start')
    await requestPublished

    agent.abort()
    await expect(run).resolves.toMatchObject({ status: 'aborted' })
    expect(agent.state).toMatchObject({ status: 'aborted', messages: [] })
    expect(agent.respond(requestId, 'Too late')).toBe(false)
    await Promise.resolve()
    expect(llm.requests).toHaveLength(1)
  })

  it('times out while waiting for human input', async () => {
    vi.useFakeTimers()
    try {
      const llm = new ScriptedLLM([toolCall('call-1', 'ask_user', { question: 'Wait?' })])
      const agent = new Agent({ llm, humanInput: {}, timeoutMs: 50 })
      let requestId = ''
      const requestPublished = new Promise<void>((resolve) => {
        agent.subscribeRequests((request) => { requestId = request.id; resolve() })
      })
      const run = agent.send('start')
      await requestPublished

      await vi.advanceTimersByTimeAsync(50)

      await expect(run).resolves.toMatchObject({ status: 'error', error: { code: 'TIMEOUT' } })
      expect(agent.state.messages).toEqual([])
      expect(agent.respond(requestId, 'Too late')).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('disposes while waiting for human input without accepting a late response', async () => {
    const llm = new ScriptedLLM([toolCall('call-1', 'ask_user', { question: 'Wait?' })])
    const agent = new Agent({ llm, humanInput: {} })
    let requestId = ''
    const requestPublished = new Promise<void>((resolve) => {
      agent.subscribeRequests((request) => { requestId = request.id; resolve() })
    })
    const run = agent.send('start')
    await requestPublished

    await agent.dispose()

    await expect(run).resolves.toMatchObject({ status: 'aborted' })
    expect(agent.state.status).toBe('disposed')
    expect(agent.respond(requestId, 'Too late')).toBe(false)
  })

  it('does not let an old request respond to a later run', async () => {
    const llm = new ScriptedLLM([
      toolCall('old-call', 'ask_user', { question: 'Old?' }),
      toolCall('new-call', 'ask_user', { question: 'New?' }),
      message('done'),
    ])
    const agent = new Agent({ llm, humanInput: {} })
    const requestIds: string[] = []
    let publishCount = 0
    let resolvePublished!: () => void
    let requestPublished = new Promise<void>((resolve) => { resolvePublished = resolve })
    agent.subscribeRequests((request) => {
      requestIds.push(request.id)
      publishCount++
      resolvePublished()
    })

    const oldRun = agent.send('old')
    await requestPublished
    agent.abort()
    await oldRun

    requestPublished = new Promise<void>((resolve) => { resolvePublished = resolve })
    const newRun = agent.send('new')
    await requestPublished
    expect(publishCount).toBe(2)
    expect(agent.respond(requestIds[0]!, 'Old answer')).toBe(false)
    expect(agent.state.status).toBe('waiting_for_input')
    expect(agent.respond(requestIds[1]!, 'New answer')).toBe(true)
    await expect(newRun).resolves.toMatchObject({ status: 'completed' })
  })

  it('executes a global tool supplied in the constructor', async () => {
    const llm = new ScriptedLLM([toolCall('call-1', 'sum', { a: 2, b: 3 }), message('5')])
    const sum: Tool<{ a: number; b: number }, number> = { name: 'sum', description: 'Add numbers', inputSchema: z.object({ a: z.number(), b: z.number() }), execute: ({ a, b }) => a + b }
    const agent = new Agent({ llm, tools: [sum] })

    await expect(agent.send('add')).resolves.toMatchObject({ status: 'completed', content: '5' })
    expect(llm.requests[0]!.tools.map(({ name }) => name)).toEqual(['sum'])
  })

  it('serializes recursive tool output for the next model step', async () => {
    const llm = new ScriptedLLM([toolCall('call-1', 'inspect', {}), message('done')])
    const agent = new Agent({
      llm,
      tools: [{
        name: 'inspect',
        description: 'Inspect structured data',
        inputSchema: z.object({}),
        execute: () => ({ success: true, details: { ids: ['1', '2'], note: null } } as const),
      }],
    })

    await agent.send('inspect')

    expect(llm.requests[1]!.messages.at(-1)).toEqual({
      role: 'tool',
      callId: 'call-1',
      name: 'inspect',
      content: '{"success":true,"details":{"ids":["1","2"],"note":null}}',
      isError: false,
    })
  })

  it('reports a serialization error when an invalid output bypasses the type contract', async () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    const llm = new ScriptedLLM([toolCall('call-1', 'invalid_output', {}), message('recovered')])
    const agent = new Agent({
      llm,
      tools: [{
        name: 'invalid_output',
        description: 'Return an invalid output',
        inputSchema: z.object({}),
        execute: () => circular as ToolOutput,
      }],
    })

    await expect(agent.send('run')).resolves.toMatchObject({ status: 'completed', content: 'recovered' })
    expect(llm.requests[1]!.messages.at(-1)).toMatchObject({
      role: 'tool',
      callId: 'call-1',
      name: 'invalid_output',
      isError: true,
      content: expect.stringContaining('TOOL_EXECUTION_ERROR'),
    })
  })

  it.each([
    ['non-finite number', Number.POSITIVE_INFINITY],
    ['class instance', new (class Result { readonly value = 1 })()],
    ['symbol property', { [Symbol('hidden')]: true }],
  ])('reports a serialization error for a %s output', async (_label, invalidOutput) => {
    const llm = new ScriptedLLM([toolCall('call-1', 'invalid_output', {}), message('recovered')])
    const agent = new Agent({
      llm,
      tools: [{
        name: 'invalid_output',
        description: 'Return an invalid output',
        inputSchema: z.object({}),
        execute: () => invalidOutput as ToolOutput,
      }],
    })

    await agent.send('run')

    expect(llm.requests[1]!.messages.at(-1)).toMatchObject({
      role: 'tool',
      isError: true,
      content: expect.stringContaining('TOOL_EXECUTION_ERROR'),
    })
  })

  it('accepts any non-empty scope key for an initial tool', () => {
    const tool: Tool = { name: 'audit', description: 'Audit', inputSchema: z.object({}), execute: () => 'ok' }
    const agent = new Agent({ llm: new ScriptedLLM([]), tools: [{ tool, scope: 'workflow-review' }] })

    expect(agent.unregisterTool('audit', { scope: 'workflow-review' })).toBe(true)
  })

  it('rejects duplicate initial tool names across scopes', () => {
    const tool: Tool = { name: 'shared', description: 'Shared', inputSchema: z.object({}), execute: () => 'ok' }

    expect(() => new Agent({
      llm: new ScriptedLLM([]),
      tools: [tool, { tool: { ...tool }, scope: 'tenant-a' }],
    })).toThrow('Tool already registered: shared')
  })

  it('rejects an empty initial tool scope', () => {
    const tool: Tool = { name: 'audit', description: 'Audit', inputSchema: z.object({}), execute: () => 'ok' }

    expect(() => new Agent({
      llm: new ScriptedLLM([]),
      tools: [{ tool, scope: '  ' }],
    })).toThrow('Tool name, description, scope, schema, and execute are required')
  })

  it('takes an initial tool snapshot instead of retaining the input array', async () => {
    const first: Tool = { name: 'first', description: 'First', inputSchema: z.object({}), execute: () => 'first' }
    const later: Tool = { name: 'later', description: 'Later', inputSchema: z.object({}), execute: () => 'later' }
    const tools: InitialTool[] = [first]
    const llm = new ScriptedLLM([message('done')])
    const agent = new Agent({ llm, tools })
    tools.push(later)

    await agent.send('inspect')
    expect(llm.requests[0]!.tools.map(({ name }) => name)).toEqual(['first'])
  })

  it('lists tool information and filters by scope without exposing execution internals', () => {
    const globalTool: Tool = { name: 'global_tool', description: 'Global', inputSchema: z.object({}), execute: () => 'global' }
    const scopedTool: Tool = { name: 'scoped_tool', description: 'Scoped', inputSchema: z.object({ value: z.string() }), execute: () => 'scoped' }
    const agent = new Agent({ llm: new ScriptedLLM([]), tools: [globalTool, { tool: scopedTool, scope: 'workflow-review' }] })

    const all = agent.listTools()
    expect(all.map(({ name, scope }) => ({ name, scope }))).toEqual([
      { name: 'global_tool', scope: 'global' },
      { name: 'scoped_tool', scope: 'workflow-review' },
    ])
    expect(agent.listTools({ scope: 'workflow-review' })).toEqual([
      { name: 'scoped_tool', description: 'Scoped', scope: 'workflow-review' },
    ])
    expect(all[0]).not.toHaveProperty('execute')
    expect(all[0]).not.toHaveProperty('registrationId')
    expect(Object.isFrozen(all)).toBe(true)
    expect(Object.isFrozen(all[0])).toBe(true)
  })

  it('returns a detached tool list and all scopes including empty scopes', () => {
    const first: Tool = { name: 'first', description: 'First', inputSchema: z.object({}), execute: () => 'first' }
    const second: Tool = { name: 'second', description: 'Second', inputSchema: z.object({}), execute: () => 'second' }
    const agent = new Agent({ llm: new ScriptedLLM([]), tools: [{ tool: first, scope: 'plugin-a' }, { tool: second, scope: 'plugin-a' }] })
    const before = agent.listTools()

    agent.registerTool({ name: 'global', description: 'Global', inputSchema: z.object({}), execute: () => 'global' })

    expect(before.map(({ name }) => name)).toEqual(['first', 'second'])
    agent.replaceToolScope('empty-scope', [])
    expect(agent.listToolScopes()).toEqual(['global', 'plugin-a', 'empty-scope'])
    expect(Object.isFrozen(agent.listToolScopes())).toBe(true)
  })

  it('removes any tool scope including global and returns the removed count', () => {
    const tool = (name: string): Tool => ({ name, description: name, inputSchema: z.object({}), execute: () => name })
    const agent = new Agent({ llm: new ScriptedLLM([]), tools: [tool('global-a'), tool('global-b'), { tool: tool('plugin'), scope: 'plugin-a' }] })

    expect(agent.removeToolScope('global')).toBe(2)
    expect(agent.listToolScopes()).toEqual(['plugin-a'])
    expect(agent.removeToolScope('missing')).toBe(0)
    expect(agent.removeToolScope('plugin-a')).toBe(1)
    expect(agent.listTools()).toEqual([])
    expect(agent.listToolScopes()).toEqual([])
  })

  it('keeps an empty scope until it is explicitly removed', () => {
    const agent = new Agent({ llm: new ScriptedLLM([]) })

    expect(agent.listToolScopes()).toEqual(['global'])
    agent.replaceToolScope('plugin-a', [])
    expect(agent.listToolScopes()).toEqual(['global', 'plugin-a'])
    const unregister = agent.registerTool({ name: 'temporary', description: 'Temporary', inputSchema: z.object({}), execute: () => 'ok' }, { scope: 'plugin-a' })
    expect(unregister()).toBe(true)
    expect(agent.listToolScopes()).toEqual(['global', 'plugin-a'])
    expect(agent.removeToolScope('plugin-a')).toBe(0)
    expect(agent.listToolScopes()).toEqual(['global'])
  })

  it('rejects blank scope queries and rejects tool inspection after disposal', async () => {
    const agent = new Agent({ llm: new ScriptedLLM([]) })

    expect(() => agent.listTools({ scope: '  ' })).toThrow('Tool scope is required')
    expect(() => agent.removeToolScope('  ')).toThrow('Tool scope is required')
    await agent.dispose()
    expect(() => agent.listTools()).toThrow('Agent has been disposed')
    expect(() => agent.listToolScopes()).toThrow('Agent has been disposed')
    expect(() => agent.removeToolScope('global')).toThrow('Agent has been disposed')
  })

  it('executes a tool and commits a continuous conversation', async () => {
    const llm = new ScriptedLLM([toolCall('call-1', 'sum', { a: 2, b: 3 }), message('5'), message('still 5')])
    const agent = new Agent({ llm })
    agent.registerTool({ name: 'sum', description: 'Add numbers', inputSchema: z.object({ a: z.number(), b: z.number() }), execute: ({ a, b }) => a + b })

    await expect(agent.send('add')).resolves.toMatchObject({ status: 'completed', content: '5' })
    await expect(agent.send('repeat')).resolves.toMatchObject({ status: 'completed', content: 'still 5' })

    expect(llm.requests[1]!.messages.at(-1)).toEqual({ role: 'tool', callId: 'call-1', name: 'sum', content: '5', isError: false })
    expect(llm.requests[2]!.messages.some((item) => item.role === 'tool' && item.callId === 'call-1')).toBe(true)
  })

  it('does not execute a replacement using an old schema', async () => {
    let resolve!: (value: LLMResponse) => void
    const llm: LLMAdapter = { invoke: () => new Promise((done) => { resolve = done }) }
    const oldExecute = vi.fn(() => 'old')
    const newExecute = vi.fn(() => 'new')
    const agent = new Agent({ llm, maxSteps: 1 })
    agent.registerTool({ name: 'route_action', description: 'Old', inputSchema: z.object({ old: z.string() }), execute: oldExecute }, { scope: 'route' })
    const run = agent.send('go')
    await Promise.resolve()
    agent.replaceTool({ name: 'route_action', description: 'New', inputSchema: z.object({ next: z.string() }), execute: newExecute }, { scope: 'route' })
    resolve(toolCall('call-1', 'route_action', { old: 'value' }))
    await run
    expect(oldExecute).not.toHaveBeenCalled()
    expect(newExecute).not.toHaveBeenCalled()
  })

  it('settles when a tool ignores cancellation', async () => {
    const llm = new ScriptedLLM([toolCall('call-1', 'hang', {})])
    const agent = new Agent({ llm })
    agent.registerTool({ name: 'hang', description: 'Never settles', inputSchema: z.object({}), execute: () => new Promise(() => undefined) })
    const run = agent.send('hang')
    await Promise.resolve()
    agent.abort()
    await expect(run).resolves.toMatchObject({ status: 'aborted' })
  })

  it('times out an adapter that never settles', async () => {
    vi.useFakeTimers()
    const agent = new Agent({ llm: { invoke: () => new Promise(() => undefined) }, timeoutMs: 50 })
    const run = agent.send('hang')
    await vi.advanceTimersByTimeAsync(50)
    await expect(run).resolves.toMatchObject({ status: 'error', error: { code: 'TIMEOUT' } })
    vi.useRealTimers()
  })

  it.each([
    ['MODEL_NETWORK_ERROR', true, undefined],
    ['MODEL_AUTH_ERROR', false, 401],
    ['MODEL_RATE_LIMIT', true, 429],
    ['MODEL_INVALID_RESPONSE', false, 200],
    ['MODEL_PROVIDER_ERROR', true, 503],
  ] as const)('maps a standardized %s without exposing its cause', async (code, retryable, statusCode) => {
    const secretCause = new Error('Authorization: Bearer secret-token')
    const agent = new Agent({
      llm: {
        invoke: () => Promise.reject(new ModelError({
          code,
          message: `Safe model failure: ${code}`,
          retryable,
          ...(statusCode === undefined ? {} : { statusCode }),
          cause: secretCause,
        })),
      },
    })

    const result = await agent.send('fail safely')

    expect(result).toMatchObject({
      status: 'error',
      error: {
        code,
        message: `Safe model failure: ${code}`,
        retryable,
        ...(statusCode === undefined ? {} : { statusCode }),
      },
    })
    expect(result).not.toHaveProperty('error.cause')
    expect(agent.state.error).toEqual(result.status === 'error' ? result.error : undefined)
    expect(agent.state.messages).toEqual([])
    expect(JSON.stringify(agent.state)).not.toContain('secret-token')
  })

  it('keeps a non-retryable MODEL_ERROR fallback for unclassified adapter failures', async () => {
    const agent = new Agent({ llm: { invoke: () => Promise.reject(new Error('Authorization: Bearer adapter-secret')) } })

    await expect(agent.send('fail')).resolves.toMatchObject({
      status: 'error',
      error: { code: 'MODEL_ERROR', message: 'Model invocation failed', retryable: false },
    })
    expect(agent.state.error).not.toHaveProperty('cause')
    expect(JSON.stringify(agent.state)).not.toContain('adapter-secret')
  })

  it('validates standardized model error metadata at runtime', () => {
    expect(() => new ModelError({ code: 'MODEL_AUTH_ERROR', message: '', retryable: false })).toThrow('message must not be empty')
    expect(() => new ModelError({ code: 'INVALID' as never, message: 'invalid code', retryable: false })).toThrow('code is invalid')
    expect(() => new ModelError({ code: 'MODEL_AUTH_ERROR', message: 'invalid retryable', retryable: 'yes' as never })).toThrow('retryable must be a boolean')
    expect(() => new ModelError({ code: 'MODEL_AUTH_ERROR', message: 'invalid status', retryable: false, statusCode: 401.5 })).toThrow('statusCode must be a finite integer')
  })

  it('ignores a standardized model error that arrives after manual cancellation', async () => {
    let rejectModel!: (error: unknown) => void
    const agent = new Agent({
      llm: { invoke: () => new Promise((_resolve, reject) => { rejectModel = reject }) },
    })
    const run = agent.send('cancel')
    await Promise.resolve()

    agent.abort()
    await expect(run).resolves.toMatchObject({ status: 'aborted' })
    rejectModel(new ModelError({ code: 'MODEL_RATE_LIMIT', message: 'too late', retryable: true, statusCode: 429 }))
    await Promise.resolve()

    expect(agent.state).toMatchObject({ status: 'aborted', result: { status: 'aborted' } })
    expect(agent.state.error).toBeUndefined()
  })

  it('isolates subscriber errors', async () => {
    const agent = new Agent({ llm: new ScriptedLLM([message('ok')]) })
    const listener = vi.fn()
    agent.subscribe(() => { throw new Error('UI failed') })
    agent.subscribe(listener)
    await agent.send('hello')
    expect(listener).toHaveBeenCalled()
  })

  it('disposes an active run without waiting for its operation', async () => {
    const agent = new Agent({ llm: { invoke: () => new Promise(() => undefined) } })
    const run = agent.send('hang')
    await agent.dispose()
    await expect(run).resolves.toMatchObject({ status: 'aborted' })
    expect(agent.state.status).toBe('disposed')
  })
})

describe('ToolRegistry', () => {
  it('does not partially register a batch when a later tool conflicts', () => {
    const tool = (name: string) => ({ name, description: name, inputSchema: z.object({}), execute: () => name })

    expect(() => new ToolRegistry([
      { tool: tool('first') },
      { tool: tool('first'), scope: 'plugin-a' },
    ])).toThrow('Tool already registered: first')
  })

  it('prevents an old unregister callback from deleting a replacement', () => {
    const registry = new ToolRegistry()
    const tool = { name: 'a', description: 'a', inputSchema: z.object({}), execute: () => 'a' }
    const unregister = registry.register(tool)
    registry.replace({ ...tool, execute: () => 'b' })
    expect(unregister()).toBe(false)
    expect(registry.snapshot().registrations.has('a')).toBe(true)
  })
})
