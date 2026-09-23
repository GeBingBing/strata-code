import { describe, expect, it } from 'vitest'
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import {
  applyAgentError,
  applyAgentStatus,
  applyMemoryRecalled,
  applySdkMessage,
  initialChatState,
  type UiItem
} from './applySdkMessage'

/** spec: chat-ui AC-1~5/8 —— 纯 reducer 全覆盖 */

const partial = (uuid: string, text: string): SDKMessage =>
  ({
    type: 'stream_event',
    event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
    parent_tool_use_id: null,
    uuid,
    session_id: 's1'
  }) as unknown as SDKMessage

const partialThinking = (uuid: string, thinking: string): SDKMessage =>
  ({
    type: 'stream_event',
    event: { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking } },
    parent_tool_use_id: null,
    uuid,
    session_id: 's1'
  }) as unknown as SDKMessage

const assistantText = (uuid: string, text: string, thinking?: string): SDKMessage =>
  ({
    type: 'assistant',
    message: {
      id: 'msg-1',
      role: 'assistant',
      model: 'm',
      content: [
        ...(thinking ? [{ type: 'thinking', thinking }] : []),
        { type: 'text', text }
      ],
      stop_reason: 'end_turn',
      type: 'message'
    },
    parent_tool_use_id: null,
    uuid,
    session_id: 's1'
  }) as unknown as SDKMessage

const assistantToolUse = (uuid: string, toolId: string, name: string, input: unknown): SDKMessage =>
  ({
    type: 'assistant',
    message: {
      id: 'msg-2',
      role: 'assistant',
      model: 'm',
      content: [{ type: 'tool_use', id: toolId, name, input }],
      stop_reason: 'tool_use',
      type: 'message'
    },
    parent_tool_use_id: null,
    uuid,
    session_id: 's1'
  }) as unknown as SDKMessage

const toolResult = (toolId: string, content: string, isError = false): SDKMessage =>
  ({
    type: 'user',
    message: {
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: toolId, content, is_error: isError }]
    },
    parent_tool_use_id: null,
    uuid: `u-tr-${toolId}`,
    session_id: 's1'
  }) as unknown as SDKMessage

const result = (cost: number): SDKMessage =>
  ({
    type: 'result',
    subtype: 'success',
    duration_ms: 100,
    duration_api_ms: 90,
    is_error: false,
    num_turns: 1,
    result: 'done',
    stop_reason: 'end_turn',
    total_cost_usd: cost,
    usage: {},
    modelUsage: {},
    permission_denials: [],
    uuid: 'u-result',
    session_id: 's1'
  }) as unknown as SDKMessage

describe('applySdkMessage', () => {
  it('AC-1: partial 增量追加为流式气泡', () => {
    let state = initialChatState
    state = applySdkMessage(state, partial('p1', 'Hello'))
    state = applySdkMessage(state, partial('p1', ' world'))

    expect(state.items).toHaveLength(1)
    expect(state.items[0]).toEqual({
      kind: 'assistant',
      id: 'streaming',
      text: 'Hello world',
      streaming: true
    })
    expect(state.streamingId).toBe('streaming')
  })

  it('AC-2: final 消息替换同轮流式气泡（不重复）', () => {
    let state = initialChatState
    state = applySdkMessage(state, partial('p1', 'Hello'))
    state = applySdkMessage(state, partial('p1', ' world'))
    state = applySdkMessage(state, assistantText('a1', 'Hello world'))

    const assistants = state.items.filter((i) => i.kind === 'assistant')
    expect(assistants).toHaveLength(1)
    // final 定稿时保持流式气泡 id 不变，避免 React remount 闪烁
    expect(assistants[0]).toEqual({
      kind: 'assistant',
      id: 'streaming',
      text: 'Hello world',
      streaming: false,
      messageId: 'assistant-a1'
    })
    expect(state.streamingId).toBeNull()
  })

  it('AC-2: 同 id final 消息重复到达 → 幂等', () => {
    let state = applySdkMessage(initialChatState, assistantText('a1', 'once'))
    state = applySdkMessage(state, assistantText('a1', 'once'))
    expect(state.items.filter((i) => i.kind === 'assistant')).toHaveLength(1)
  })

  it('final 消息按 messageId 去重（流式气泡已定稿后再次收到同 final）', () => {
    let state = initialChatState
    state = applySdkMessage(state, partial('p1', 'Hello'))
    state = applySdkMessage(state, assistantText('a1', 'Hello'))
    state = applySdkMessage(state, assistantText('a1', 'Hello'))
    expect(state.items.filter((i) => i.kind === 'assistant')).toHaveLength(1)
  })

  /** 多轮追问污染 bug：定稿后 partial 不应复用旧 bubble（id 已被改名） */
  it('多轮：定稿后新一轮 partial 不追加到上一个 bubble', () => {
    // 第一轮：partial 累积 + result 定稿
    let state = initialChatState
    state = applySdkMessage(state, partial('p1', 'first '))
    state = applySdkMessage(state, partial('p1', 'reply'))
    state = applySdkMessage(state, {
      ...result(0.01),
      result: 'first reply'
    } as unknown as SDKMessage)
    // 第一轮结束：streamingId=null，bubble id 已不再是 'streaming'

    // 第二轮：partial 应当走新 bubble，不追加到第一轮已定稿的内容
    state = applySdkMessage(state, partial('p2', 'second '))
    state = applySdkMessage(state, partial('p2', 'reply'))

    const assistants = state.items.filter((i) => i.kind === 'assistant')
    expect(assistants).toHaveLength(2)
    // 两个 bubble 文本互不污染
    expect(assistants.map((a) => (a as Extract<UiItem, { kind: 'assistant' }>).text)).toEqual([
      'first reply',
      'second reply'
    ])
    // 第二轮 bubble 是当前 streaming
    expect(state.streamingId).not.toBeNull()
    expect(
      assistants.some(
          (a) => a.kind === 'assistant' && a.id === state.streamingId && a.streaming === true
        )
    ).toBe(true)
  })

  /** applyAssistant 定稿保留 id='streaming'（避免 remount 闪烁）；partial 端需智能换 id */
  it('多轮：applyAssistant 定稿后新一轮 partial 不复用定稿 bubble', () => {
    let state = initialChatState
    state = applySdkMessage(state, partial('p1', 'first '))
    state = applySdkMessage(state, partial('p1', 'reply'))
    state = applySdkMessage(state, assistantText('a1', 'first reply'))
    // 此时：applyAssistant 定稿，bubble id 仍 'streaming'，streamingId=null

    // 第二轮 partial —— 不应追加到 'streaming' 的已定稿 bubble
    state = applySdkMessage(state, partial('p2', 'second '))
    state = applySdkMessage(state, partial('p2', 'reply'))

    const assistants = state.items.filter((i) => i.kind === 'assistant') as Extract<
      UiItem,
      { kind: 'assistant' }
    >[]
    expect(assistants).toHaveLength(2)
    expect(assistants.map((a) => a.text)).toEqual(['first reply', 'second reply'])
    expect(assistants.map((a) => a.streaming)).toEqual([false, true])
    // 第二轮是新的 streaming 气泡，且不是被已定稿 bubble 占用的 'streaming' id
    const active = assistants.find((a) => a.streaming)!
    expect(active.id).not.toBe('streaming')
  })

  it('thinking partial 增量追加到流式气泡', () => {
    let state = initialChatState
    state = applySdkMessage(state, partialThinking('p1', 'step 1'))
    state = applySdkMessage(state, partialThinking('p1', 'step 2'))

    const assistant = state.items.find((i) => i.kind === 'assistant') as Extract<UiItem, { kind: 'assistant' }>
    expect(assistant).toBeDefined()
    expect(assistant.thinking).toBe('step 1step 2')
  })

  it('final assistant 消息解析 thinking 块并保留到 UiItem', () => {
    const state = applySdkMessage(initialChatState, assistantText('a1', 'answer', 'inner monologue'))
    const assistant = state.items.find((i) => i.kind === 'assistant') as Extract<UiItem, { kind: 'assistant' }>
    expect(assistant.text).toBe('answer')
    expect(assistant.thinking).toBe('inner monologue')
  })

  it('AC-3/4: tool_use 创建 running 条目；tool_result 置为完成态', () => {
    let state = initialChatState
    state = applySdkMessage(state, assistantToolUse('a2', 'tool-1', 'Read', { file_path: '/x' }))

    expect(state.items).toHaveLength(1)
    expect(state.items[0]).toMatchObject({
      kind: 'tool',
      id: 'tool-1',
      toolName: 'Read',
      status: 'running'
    })

    state = applySdkMessage(state, toolResult('tool-1', 'file content'))
    expect(state.items[0]).toMatchObject({ kind: 'tool', status: 'success', output: 'file content' })

    // error 工具结果
    state = applySdkMessage(state, assistantToolUse('a3', 'tool-2', 'Bash', { command: 'x' }))
    state = applySdkMessage(state, toolResult('tool-2', 'boom', true))
    expect(state.items.find((i) => i.id === 'tool-2')).toMatchObject({ status: 'error' })
  })

  it('AC-4: 无匹配 tool_use 的 tool_result → 忽略', () => {
    const state = applySdkMessage(initialChatState, toolResult('ghost', 'x'))
    expect(state.items).toHaveLength(0)
  })

  it('AC-5: result → idle + cost/duration', () => {
    const state = applySdkMessage(initialChatState, result(0.123))
    expect(state.status).toBe('idle')
    expect(state.costUsd).toBeCloseTo(0.123)
    expect(state.durationMs).toBe(100)
  })

  it('AC-8: applyAgentError 追加错误条目并复位状态', () => {
    const state = applyAgentError({ ...initialChatState, status: 'running' }, 'network down')
    expect(state.status).toBe('idle')
    expect(state.items[0]).toMatchObject({ kind: 'error', text: 'network down' })
  })

  it('回放的字符串用户消息去重（乐观渲染已存在）', () => {
    let state = applyAgentError(initialChatState, '') // noop 形状
    state = { ...state, items: [{ kind: 'user', id: 'local-1', text: 'hi' }] }
    state = applySdkMessage(state, {
      type: 'user',
      message: { role: 'user', content: 'hi' },
      parent_tool_use_id: null,
      uuid: 'u-echo'
    } as unknown as SDKMessage)
    expect(state.items.filter((i) => i.kind === 'user')).toHaveLength(1)
  })

  /** spec: file-context-mentions —— 带 attachments 的 user item 在 reducer 中保留 */
  it('带 attachments 的 user item 不被覆盖', () => {
    const attachment = { type: 'file' as const, id: 'f-1', path: '/x.ts', label: 'x.ts' }
    let state = applyAgentError(initialChatState, '') // noop 形状
    state = {
      ...state,
      items: [{ kind: 'user' as const, id: 'local-1', text: 'hi', attachments: [attachment] }]
    }
    state = applySdkMessage(state, {
      type: 'assistant',
      message: { role: 'assistant', model: 'm', content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn', type: 'message' },
      parent_tool_use_id: null,
      uuid: 'a1'
    } as unknown as SDKMessage)
    const user = state.items.find((i) => i.kind === 'user') as Extract<UiItem, { kind: 'user' }>
    expect(user.attachments).toEqual([attachment])
  })
})

/** spec: context-engineering AC-5 —— token 用量透传到 ChatState */
describe('applySdkMessage token 用量', () => {
  it('result 消息 → ChatState.usage/numTurns', () => {
    const msg = {
      ...result(0.123),
      num_turns: 3,
      usage: { input_tokens: 1200, output_tokens: 345 }
    } as unknown as SDKMessage
    const state = applySdkMessage(initialChatState, msg)
    expect(state.usage).toEqual({ inputTokens: 1200, outputTokens: 345 })
    expect(state.numTurns).toBe(3)
  })

  it('usage 缺失 → 字段保持 undefined', () => {
    const state = applySdkMessage(initialChatState, result(0.1))
    expect(state.usage).toBeUndefined()
  })

  it('applyAgentStatus 含 usage/numTurns → 透传', () => {
    const state = applyAgentStatus(initialChatState, 'idle', {
      usage: { inputTokens: 10, outputTokens: 5 },
      numTurns: 2
    })
    expect(state.usage).toEqual({ inputTokens: 10, outputTokens: 5 })
    expect(state.numTurns).toBe(2)
  })
})

/** spec: memory-rendering AC-1/2/4 —— 记忆召回与压缩边界的 reducer */
describe('applySdkMessage 记忆链路', () => {
  const memoryRecall = (uuid: string): SDKMessage =>
    ({
      type: 'system',
      subtype: 'memory_recall',
      mode: 'select',
      memories: [
        { path: '/home/u/.claude/memory/preferences.md', scope: 'personal', content: 'User prefers TypeScript.' },
        { path: '/home/u/.claude/memory/facts.md', scope: 'personal' }
      ],
      uuid,
      session_id: 's1'
    }) as unknown as SDKMessage

  it('AC-1: SDK memory_recall → 不展示给用户（默默注入）', () => {
    const state = applySdkMessage(initialChatState, memoryRecall('u-recall-1'))
    expect(state.items).toHaveLength(0)
  })

  it('AC-1: 多次 memory_recall 依然不展示', () => {
    let state = applySdkMessage(initialChatState, memoryRecall('u-recall-1'))
    state = applySdkMessage(state, memoryRecall('u-recall-1'))
    state = applySdkMessage(state, memoryRecall('u-recall-2'))
    expect(state.items).toHaveLength(0)
  })

  it('AC-1: 其他 system subtype 维持忽略', () => {
    const state = applySdkMessage(initialChatState, {
      type: 'system',
      subtype: 'init',
      uuid: 'u-init',
      session_id: 's1'
    } as unknown as SDKMessage)
    expect(state.items).toHaveLength(0)
  })

  it('AC-2: applyMemoryRecalled → 不展示给用户', () => {
    const event = {
      sessionId: 's1',
      source: 'app' as const,
      memories: [
        { id: 'm-1', kind: 'preference' as const, content: 'User prefers concise replies.' },
        { id: 'm-2', kind: 'skill' as const, content: 'Run npm test before commit.' }
      ]
    }
    const state = applyMemoryRecalled(initialChatState, event)
    expect(state.items).toHaveLength(0)
  })

  it('AC-4: compact_boundary → compact UiItem', () => {
    const state = applySdkMessage(initialChatState, {
      type: 'system',
      subtype: 'compact_boundary',
      compact_metadata: { trigger: 'auto', pre_tokens: 100000, post_tokens: 12000 },
      uuid: 'u-compact',
      session_id: 's1'
    } as unknown as SDKMessage)
    const item = state.items[0] as Extract<UiItem, { kind: 'compact' }>
    expect(item.kind).toBe('compact')
    expect(item.trigger).toBe('auto')
    expect(item.preTokens).toBe(100000)
    expect(item.postTokens).toBe(12000)
  })
})
