import type {
  SDKMessage,
  SDKPartialAssistantMessage,
  SDKUserMessage
} from '@anthropic-ai/claude-agent-sdk'
import type { AgentStatus, MemoryKind, MemoryRecalledEvent, MentionAttachment } from '@shared/types'

/** 渲染层 UI 条目（chat-ui spec 契约 + memory-rendering 扩展） */
export type UiItem =
  | { kind: 'user'; id: string; text: string; attachments?: MentionAttachment[] }
  | { kind: 'assistant'; id: string; text: string; streaming?: boolean; messageId?: string; thinking?: string }
  | {
      kind: 'tool'
      id: string
      toolName: string
      input: unknown
      status: 'running' | 'success' | 'error'
      output?: string
      messageId?: string
    }
  | { kind: 'error'; id: string; text: string }
  | {
      /** 记忆召回块（spec: memory-rendering）：sdk = SDK memory_recall；app = memory:recalled 事件 */
      kind: 'memory'
      id: string
      source: 'app' | 'sdk'
      entries: { kind: MemoryKind; content: string }[]
    }
  | {
      /** 上下文压缩边界（spec: memory-rendering） */
      kind: 'compact'
      id: string
      trigger: 'manual' | 'auto'
      preTokens: number
      postTokens?: number
    }

export interface ChatState {
  status: AgentStatus
  items: UiItem[]
  /** 当前流式气泡的 id（打字机光标锚点） */
  streamingId: string | null
  costUsd?: number
  durationMs?: number
  /** token 用量（spec: context-engineering） */
  usage?: { inputTokens: number; outputTokens: number; cacheReadTokens?: number; cacheCreationTokens?: number }
  numTurns?: number
  /** 最近一次蒸馏结果（spec: memory-rendering 状态栏徽标） */
  lastDistill?: { added: number; updated: number; retired: number; updatedAt: number }
  /** spec: cursor-parity AC-7 —— 上一回合被中断，显示「继续」按钮 */
  interrupted?: boolean
  /** spec: composer-history —— Composer 文本事实源 */
  composerDraft?: string
  /** 已发送消息环形缓冲 */
  history?: string[]
  /** null = 不在历史模式；否则为 history 索引 */
  historyCursor?: number | null
  /** 进入历史模式前暂存的草稿 */
  preHistoryDraft?: string
}

export const initialChatState: ChatState = { status: 'idle', items: [], streamingId: null }

interface ContentBlock {
  type: string
  text?: string
  id?: string
  name?: string
  input?: unknown
  tool_use_id?: string
  content?: string | ContentBlock[]
  is_error?: boolean
  thinking?: string
}

interface PartialDelta {
  type: string
  text?: string
  thinking?: string
}

/**
 * SDKMessage → ChatState 纯 reducer（chat-ui spec AC-1~5/8）。
 * 所有渲染层逻辑的单一来源 —— 完全可单测，不依赖 React。
 */
export function applySdkMessage(state: ChatState, msg: SDKMessage): ChatState {
  switch (msg.type) {
    case 'stream_event':
      return applyPartial(state, msg)
    case 'assistant':
      return applyAssistant(state, msg)
    case 'user':
      return applyUser(state, msg as SDKUserMessage)
    case 'system':
      return applySystem(state, msg)
    case 'result':
      return {
        ...state,
        status: 'idle',
        interrupted: false,
        costUsd: msg.total_cost_usd,
        durationMs: msg.duration_ms,
        ...(msg.usage && typeof msg.usage.input_tokens === 'number'
          ? {
              usage: {
                inputTokens: msg.usage.input_tokens,
                outputTokens: msg.usage.output_tokens ?? 0,
                ...(msg.usage.cache_read_input_tokens !== undefined
                  ? { cacheReadTokens: msg.usage.cache_read_input_tokens }
                  : {}),
                ...(msg.usage.cache_creation_input_tokens !== undefined
                  ? { cacheCreationTokens: msg.usage.cache_creation_input_tokens }
                  : {})
              }
            }
          : {}),
        ...(msg.num_turns !== undefined ? { numTurns: msg.num_turns } : {}),
        streamingId: null,
        // 残留的流式气泡定稿（如被中断的回合）—— 停止打字机光标
        items: finalizeStreamingItems(state)
      }
    default:
      return state
  }
}

const STREAMING_ITEM_ID = 'streaming'

/** 选取 partial 气泡 id。规则：优先用 streamingId；否则用 STREAMING_ITEM_ID，但若该 id
 *  已被已 finalize 的 bubble 占用（applyAssistant 定稿时保留 id 不变以避免 remount 闪烁），
 *  改用唯一新 id，避免多轮追问时把 Q2 的文本追加到 Q1 已定稿的 bubble 上。 */
function nextStreamingId(state: ChatState): string {
  if (state.streamingId) return state.streamingId
  const occupied = state.items.some(
    (it) => it.kind === 'assistant' && it.id === STREAMING_ITEM_ID && !it.streaming
  )
  if (occupied) {
    return `streaming-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  }
  return STREAMING_ITEM_ID
}

/** partial 流式增量（AC-1）：content_block_delta 的 text/thinking 增量追加。
 *  无论 partial 消息的 uuid 如何变化，同一回合只保留一个流式气泡，避免多个「思考中」。 */
function applyPartial(state: ChatState, msg: SDKPartialAssistantMessage): ChatState {
  const event = msg.event as { type?: string; index?: number; delta?: PartialDelta }
  if (event.type !== 'content_block_delta') {
    return state
  }
  const id = state.streamingId ?? nextStreamingId(state)
  const existing = state.items.find(
    (it) => it.kind === 'assistant' && it.id === id
  ) as Extract<UiItem, { kind: 'assistant' }> | undefined

  const textChunk = event.delta?.type === 'text_delta' ? event.delta.text ?? '' : ''
  const thinkingChunk = event.delta?.type === 'thinking_delta' ? event.delta.thinking ?? '' : ''

  if (!textChunk && !thinkingChunk) return state

  if (existing) {
    return {
      ...state,
      streamingId: id,
      items: state.items.map((it) =>
        it.kind === 'assistant' && it.id === id
          ? {
              ...it,
              text: textChunk ? it.text + textChunk : it.text,
              thinking: thinkingChunk
                ? (it.thinking ?? '') + thinkingChunk
                : it.thinking
            }
          : it
      )
    }
  }
  return {
    ...state,
    streamingId: id,
    items: [
      ...state.items,
      {
        kind: 'assistant',
        id,
        text: textChunk,
        thinking: thinkingChunk || undefined,
        streaming: true
      }
    ]
  }
}

/** final assistant 消息（AC-2/3）：替换流式气泡（去重）+ 注册 tool_use */
function applyAssistant(state: ChatState, msg: SDKMessage): ChatState {
  const content = (msg as unknown as { message?: { content?: unknown[] } }).message?.content
  const blocks = (content ?? []) as ContentBlock[]
  const messageId = `assistant-${String((msg as { uuid?: string }).uuid)}`

  let items = state.items
  let streamingId = state.streamingId

  const text = blocks.find((b) => b.type === 'text')?.text
  const thinking = blocks.find((b) => b.type === 'thinking')?.thinking
  const toolBlocks = blocks.filter((b) => b.type === 'tool_use')

  // tool_use block → 工具条目（先于 text/thinking 处理，让"调用"早于"结果"）
  for (const tool of toolBlocks) {
    if (!tool.id) continue
    const already = items.some((it) => it.kind === 'tool' && it.id === tool.id)
    if (!already) {
      items = [
        ...items,
        {
          kind: 'tool',
          id: tool.id,
          toolName: tool.name ?? 'unknown',
          input: tool.input,
          status: 'running',
          messageId
        }
      ]
    }
  }

  // text / thinking：定稿或新增（处理晚于 tool_use，使"调用"先于"结果"显示）
  if (text || thinking) {
    const streaming = state.streamingId
      ? (state.items.find(
          (it) => it.kind === 'assistant' && it.id === state.streamingId
        ) as Extract<UiItem, { kind: 'assistant' }> | undefined)
      : undefined

    if (streaming) {
      items = items.map((it) =>
        it.kind === 'assistant' && it.id === streaming.id
          ? {
              kind: 'assistant' as const,
              id: it.id,
              text: text ?? it.text,
              thinking: thinking ?? it.thinking,
              streaming: false,
              messageId
            }
          : it
      )
      streamingId = null
    } else {
      const dup = items.some(
        (it) => it.kind === 'assistant' && (it.id === messageId || it.messageId === messageId)
      )
      if (!dup) {
        const newItem: Extract<UiItem, { kind: 'assistant' }> = {
          kind: 'assistant' as const,
          id: messageId,
          text: text ?? ''
        }
        if (thinking) newItem.thinking = thinking
        items = [...items, newItem]
      }
    }
  }

  return { ...state, items, streamingId }
}

/** user 消息回放：tool_result → 完成工具条目（AC-4）；文本用户消息去重 */
function applyUser(state: ChatState, msg: SDKUserMessage): ChatState {
  const content = msg.message.content
  if (typeof content === 'string') {
    // 回放的原始用户消息 —— 乐观渲染已存在同文本气泡时不重复
    const dup = state.items.some((it) => it.kind === 'user' && it.text === content)
    return dup ? state : { ...state, items: [...state.items, { kind: 'user', id: String(msg.uuid ?? `user-${state.items.length}`), text: content }] }
  }

  const blocks = content as ContentBlock[]
  let items = state.items
  for (const block of blocks) {
    if (block.type !== 'tool_result' || !block.tool_use_id) continue
    const output = typeof block.content === 'string' ? block.content : ''
    items = items.map((it) =>
      it.kind === 'tool' && it.id === block.tool_use_id
        ? { ...it, status: block.is_error ? ('error' as const) : ('success' as const), output }
        : it
    )
  }
  return { ...state, items }
}

/** system 消息：compact_boundary 渲染；memory_recall 默默丢弃（不展示给用户） */
function applySystem(state: ChatState, msg: SDKMessage): ChatState {
  const sys = msg as unknown as {
    subtype?: string
    uuid?: string
    compact_metadata?: { trigger?: string; pre_tokens?: number; post_tokens?: number }
  }
  // memory_recall 不再注入 UI —— 记忆注入仍在主进程继续，只是不渲染
  if (sys.subtype === 'memory_recall') {
    return state
  }
  if (sys.subtype === 'compact_boundary' && sys.uuid) {
    const meta = sys.compact_metadata ?? {}
    return {
      ...state,
      items: [
        ...state.items,
        {
          kind: 'compact',
          id: sys.uuid,
          trigger: meta.trigger === 'manual' ? 'manual' : 'auto',
          preTokens: meta.pre_tokens ?? 0,
          ...(meta.post_tokens !== undefined ? { postTokens: meta.post_tokens } : {})
        }
      ]
    }
  }
  return state
}

/** memory:recalled 事件 → 默默丢弃，不渲染给用户 */
export function applyMemoryRecalled(_state: ChatState, _event: MemoryRecalledEvent): ChatState {
  return _state
}

/** 把残留的流式气泡定稿（result 到达时）。导出供 chatStore 在多轮 send 时复用。
 *  关键：把 id 从 'streaming' 重命名为唯一值，避免下一轮 partial 用 STREAMING_ITEM_ID
 *  找到这个已定稿的 bubble 并继续追加文本（多轮追问污染 bug）。 */
export function finalizeStreamingItems(state: ChatState): UiItem[] {
  if (!state.streamingId) return state.items
  const finalizedId = `assistant-final-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  return state.items.map((it) =>
    it.kind === 'assistant' && it.id === state.streamingId
      ? { ...it, id: finalizedId, streaming: false }
      : it
  )
}

/** agent:error → 错误条目（AC-8） */
export function applyAgentError(state: ChatState, error: string): ChatState {
  return {
    ...state,
    status: 'idle',
    streamingId: null,
    interrupted: false,
    items: [...state.items, { kind: 'error', id: `error-${state.items.length}`, text: error }]
  }
}

/** agent:status 直接应用 */
export function applyAgentStatus(
  state: ChatState,
  status: AgentStatus,
  extra?: {
    costUsd?: number
    durationMs?: number
    usage?: ChatState['usage']
    numTurns?: number
  }
): ChatState {
  return { ...state, status, ...extra }
}
