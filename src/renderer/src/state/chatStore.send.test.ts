import { describe, expect, it, beforeEach, vi } from 'vitest'
import { useChatStore } from './chatStore'
import { useSessionStore } from './sessionStore'
import { setIpcOverride } from '../ipc/client'
import type { RendererApi } from '@shared/ipc'
import type { UiItem } from '../lib/applySdkMessage'
import type { MentionAttachment } from '@shared/types'

/** spec: chat-ui —— 多轮 send 不污染上一轮（streaming 残留定稿） */

const invokeMock = vi.fn()

function makeApi(): RendererApi {
  return {
    invoke: invokeMock as never,
    on: (() => () => {}) as never
  }
}

beforeEach(() => {
  invokeMock.mockReset().mockResolvedValue(undefined)
  setIpcOverride(makeApi())
  useChatStore.setState({
    items: [],
    status: 'idle',
    streamingId: null
  })
  useSessionStore.setState({ activeId: null })
})

describe('chatStore.send 多轮追问', () => {
  it('第二轮 send 定稿第一轮的 streaming 气泡，新增独立 user 条目', async () => {
    // 第一轮：Q1 + 模拟流式回复进行中
    useChatStore.setState({
      items: [
        { kind: 'user', id: 'u-1', text: 'first question' },
        {
          kind: 'assistant',
          id: 'streaming',
          text: 'partial answer...',
          streaming: true
        }
      ],
      status: 'running',
      streamingId: 'streaming'
    })

    await useChatStore.getState().send('second question')

    const items = useChatStore.getState().items as UiItem[]
    // 第一轮的 streaming 气泡被定稿（streaming=false），且 id 被重命名为唯一值，
    // 避免下一轮 partial 用 STREAMING_ITEM_ID 找到它继续追加文本
    const firstAssistant = items.find((i) => i.kind === 'assistant')
    expect(firstAssistant).toBeDefined()
    expect(firstAssistant && 'streaming' in firstAssistant && firstAssistant.streaming).toBe(false)
    expect(firstAssistant && 'id' in firstAssistant && firstAssistant.id).not.toBe('streaming')

    // 第二个 user 项被加入（且不是合并到 assistant）
    const userItems = items.filter((i) => i.kind === 'user')
    expect(userItems).toHaveLength(2)
    expect(userItems.map((u) => (u as Extract<UiItem, { kind: 'user' }>).text)).toEqual([
      'first question',
      'second question'
    ])

    // streamingId 已清空，下一轮 partial 不再写旧气泡
    expect(useChatStore.getState().streamingId).toBeNull()
  })

  /** spec: file-context-mentions */
  it('send 把 attachments 透传给 agent:send 并渲染在乐观 UI 中', async () => {
    const attachment: MentionAttachment = { type: 'file', id: 'f-1', path: '/x.ts', label: 'x.ts' }

    await useChatStore.getState().send('check this', [attachment])

    expect(invokeMock).toHaveBeenCalledWith(
      'agent:send',
      expect.objectContaining({ text: 'check this', attachments: [attachment] })
    )

    const items = useChatStore.getState().items as UiItem[]
    const userItem = items.find((i) => i.kind === 'user') as Extract<UiItem, { kind: 'user' }>
    expect(userItem.attachments).toEqual([attachment])
  })

  /** spec: composer-history AC-1 —— send 推入 history（去连续重复） */
  it('send 把文本加入 history（连续重复不重复入栈）', async () => {
    useChatStore.setState({ history: [] })
    await useChatStore.getState().send('first')
    await useChatStore.getState().send('second')
    await useChatStore.getState().send('second') // 同上一次应去重
    await useChatStore.getState().send('third')

    expect(useChatStore.getState().history).toEqual(['first', 'second', 'third'])
  })

  /** spec: composer-history AC-2/3 —— navigateHistory 状态机 */
  it('navigateHistory 上下箭头恢复历史与原始草稿', () => {
    useChatStore.setState({
      history: ['h1', 'h2', 'h3'],
      historyCursor: null,
      preHistoryDraft: '',
      composerDraft: 'draft'
    })

    // up：暂存草稿 + 进入最新一条
    useChatStore.getState().navigateHistory('up')
    let s = useChatStore.getState()
    expect(s.composerDraft).toBe('h3')
    expect(s.historyCursor).toBe(2)
    expect(s.preHistoryDraft).toBe('draft')

    // up：前进一条
    useChatStore.getState().navigateHistory('up')
    s = useChatStore.getState()
    expect(s.composerDraft).toBe('h2')
    expect(s.historyCursor).toBe(1)

    // down：回到 h3
    useChatStore.getState().navigateHistory('down')
    s = useChatStore.getState()
    expect(s.composerDraft).toBe('h3')

    // down 越过最新：恢复草稿并退出历史
    useChatStore.getState().navigateHistory('down')
    s = useChatStore.getState()
    expect(s.composerDraft).toBe('draft')
    expect(s.historyCursor).toBeNull()
  })

  /** spec: composer-history AC-4 —— setComposerDraft 退出历史模式 */
  it('setComposerDraft 退出历史模式', () => {
    useChatStore.setState({
      history: ['h1'],
      historyCursor: 0,
      preHistoryDraft: 'orig',
      composerDraft: 'h1'
    })
    useChatStore.getState().setComposerDraft('new typing')
    const s = useChatStore.getState()
    expect(s.historyCursor).toBeNull()
    expect(s.preHistoryDraft).toBe('')
    expect(s.composerDraft).toBe('new typing')
  })

  /** spec: composer-history AC-7 —— reset 清空 history 与草稿 */
  it('reset 清空 history 与 composerDraft', async () => {
    await useChatStore.getState().send('hello')
    useChatStore.setState({ composerDraft: 'half' })

    useChatStore.getState().reset()

    expect(useChatStore.getState().history).toEqual([])
    expect(useChatStore.getState().composerDraft).toBe('')
  })

  /** spec: error-recovery AC-2/5 —— retry 保留 session */
  it('retry 以同一 sessionId 重发并截断到最后一条 user 之前', async () => {
    useSessionStore.setState({ activeId: 'sess-1' })
    useChatStore.setState({
      items: [
        { kind: 'user', id: 'u1', text: 'first' },
        { kind: 'assistant', id: 'a1', text: 'reply' },
        { kind: 'error', id: 'e1', text: 'boom' }
      ],
      status: 'error',
      streamingId: null
    })

    await useChatStore.getState().retry()

    expect(invokeMock).toHaveBeenCalledWith(
      'agent:send',
      expect.objectContaining({ sessionId: 'sess-1', text: 'first' })
    )
    const items = useChatStore.getState().items
    // 旧的 assistant/error 被截断；新的 user 追加（含原 attachments 若有）
    expect(items.filter((i) => i.kind === 'user')).toHaveLength(1)
    expect(items.find((i) => i.kind === 'error')).toBeUndefined()
  })

  /** spec: error-recovery AC-4/5 —— regenerate 保留 session */
  it('regenerate 以同一 sessionId 重发并截断到前置 user 之前', async () => {
    useSessionStore.setState({ activeId: 'sess-1' })
    useChatStore.setState({
      items: [
        { kind: 'user', id: 'u1', text: 'old question' },
        { kind: 'assistant', id: 'a1', text: 'old answer' },
        { kind: 'user', id: 'u2', text: 'retry question' },
        { kind: 'assistant', id: 'a2', text: 'retry answer' }
      ],
      status: 'idle',
      streamingId: null
    })

    await useChatStore.getState().regenerate('a2')

    expect(invokeMock).toHaveBeenCalledWith(
      'agent:send',
      expect.objectContaining({ sessionId: 'sess-1', text: 'retry question' })
    )
    const items = useChatStore.getState().items
    // 截断到 u2 之前，然后 send 追加新的 user 气泡（含 attachments 若有）
    expect(items.filter((i) => i.kind === 'user').map((u) => (u as Extract<UiItem, { kind: 'user' }>).text)).toEqual(['old question', 'retry question'])
    expect(items.filter((i) => i.kind === 'assistant').map((a) => (a as Extract<UiItem, { kind: 'assistant' }>).text)).toEqual(['old answer'])
  })
})