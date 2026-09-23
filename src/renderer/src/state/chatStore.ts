import { create } from 'zustand'
import type { AgentErrorEvent, AgentStatusEvent, MemoryDistilledEvent, MemoryRecalledEvent, MentionAttachment } from '@shared/types'
import {
  applyAgentError,
  applyAgentStatus,
  applyMemoryRecalled,
  applySdkMessage,
  finalizeStreamingItems,
  initialChatState,
  type ChatState,
  type UiItem
} from '../lib/applySdkMessage'
import { exportToJson, exportToMarkdown } from '../lib/sessionExport'
import { invoke, subscribe } from '../ipc/client'
import { useSessionStore } from './sessionStore'

/**
 * 聊天状态（chat-ui spec）。
 * IPC 事件 → applySdkMessage 纯 reducer → zustand store。
 */
interface ChatActions {
  send: (text: string, attachments?: MentionAttachment[]) => Promise<void>
  stop: () => Promise<void>
  /** 重试：截断到最后一条用户消息并以同一 sessionId 重发（error-recovery AC-2/5） */
  retry: () => Promise<void>
  /** 重新生成：截断到前置用户消息并以同一 sessionId 重发（error-recovery AC-4/5） */
  regenerate: (messageId: string) => Promise<void>
  /** 导出会话：Markdown 或 JSON（session-export AC-2/3） */
  exportSession: (format: 'markdown' | 'json') => Promise<void>
  /** 打开历史会话：清空并回放历史消息（session-history AC-4） */
  openSession: (messages: unknown[]) => void
  /** 新对话：清空 */
  reset: () => void
  /** spec: composer-history —— 更新 Composer 草稿 */
  setComposerDraft: (text: string) => void
  /** spec: composer-history —— 历史导航：'up'/'down'/'reset' */
  navigateHistory: (direction: 'up' | 'down' | 'reset') => void
  /** 订阅 IPC 事件（App 挂载时调用一次） */
  connect: () => () => void
}

const HISTORY_LIMIT = 50

export const useChatStore = create<ChatState & ChatActions>((set, get) => ({
  ...initialChatState,
  composerDraft: '',
  history: [],
  historyCursor: null,
  preHistoryDraft: '',

  send: async (text, attachments) => {
    // 乐观 UI（AC-7）：先定稿残留 streaming 气泡（多轮追问时不污染上轮），再追加用户气泡
    set((s) => {
      const items = finalizeStreamingItems(s)
      const userItem: Extract<UiItem, { kind: 'user' }> = { kind: 'user', id: `local-${Date.now()}`, text }
      if (attachments?.length) {
        userItem.attachments = attachments
      }
      // spec: composer-history AC-1 —— 去连续重复后入栈
      const history = s.history ?? []
      const last = history[history.length - 1]
      const nextHistory = text && text !== last
        ? [...history.slice(-(HISTORY_LIMIT - 1)), text]
        : history
      return {
        status: 'running',
        streamingId: null,
        interrupted: false,
        items: [...items, userItem],
        history: nextHistory,
        historyCursor: null,
        preHistoryDraft: '',
        composerDraft: ''
      }
    })
    // activeId 存在 → 恢复该会话（主进程 resume 语义）
    const sessionId = useSessionStore.getState().activeId ?? undefined
    await invoke('agent:send', { sessionId, text, attachments })
  },

  stop: async () => {
    await invoke('agent:interrupt')
    set({ interrupted: true })
  },

  retry: async () => {
    const items = get().items
    let lastUserIdx = -1
    for (let i = items.length - 1; i >= 0; i--) {
      if (items[i].kind === 'user') { lastUserIdx = i; break }
    }
    if (lastUserIdx < 0) return
    const lastUser = items[lastUserIdx] as Extract<UiItem, { kind: 'user' }>
    // 截断到最后一条 user 之前，以同一 sessionId 重新发送（AC-2/5）
    set({ items: items.slice(0, lastUserIdx), status: 'idle', streamingId: null, interrupted: false })
    await get().send(lastUser.text, lastUser.attachments)
  },

  regenerate: async (messageId) => {
    const items = get().items
    const index = items.findIndex((it) => it.kind === 'assistant' && it.id === messageId)
    if (index === -1) return
    let userIdx = -1
    for (let i = index - 1; i >= 0; i--) {
      if (items[i].kind === 'user') { userIdx = i; break }
    }
    if (userIdx < 0) return
    const userItem = items[userIdx] as Extract<UiItem, { kind: 'user' }>
    // 截断到该 user 消息之前，以同一 sessionId 重新发送（AC-4/5）
    set({ items: items.slice(0, userIdx), status: 'idle', streamingId: null, interrupted: false })
    await get().send(userItem.text, userItem.attachments)
  },

  exportSession: async (format) => {
    const items = get().items
    const content = format === 'markdown' ? exportToMarkdown(items) : exportToJson(items)
    const extension = format === 'markdown' ? 'md' : 'json'
    const defaultName = `session-${new Date().toISOString().slice(0, 10)}.${extension}`
    await invoke('session:export', { content, defaultName })
  },

  openSession: (messages) => {
    let state: ChatState = { ...initialChatState }
    for (const raw of messages) {
      state = applySdkMessage(state, raw as never)
    }
    // spec: composer-history AC-7 —— 切换会话时清空 Composer 草稿与历史导航
    set({
      ...state,
      composerDraft: '',
      history: [],
      historyCursor: null,
      preHistoryDraft: ''
    })
  },

  reset: () => {
    // spec: composer-history AC-7 —— 新对话时清空 Composer 草稿与历史
    set({
      ...initialChatState,
      composerDraft: '',
      history: [],
      historyCursor: null,
      preHistoryDraft: ''
    })
  },

  setComposerDraft: (text) => {
    // 任何输入退出历史模式
    if (get().historyCursor !== null) {
      set({ historyCursor: null, preHistoryDraft: '' })
    }
    set({ composerDraft: text })
  },

  navigateHistory: (direction) => {
    const s = get()
    const history = s.history ?? []
    if (history.length === 0) return
    if (direction === 'reset') {
      set({ historyCursor: null, preHistoryDraft: '' })
      return
    }
    if (direction === 'up') {
      if (s.historyCursor === null) {
        if (s.composerDraft === '') {
          set({ historyCursor: history.length - 1, preHistoryDraft: '', composerDraft: history[history.length - 1] })
          return
        }
        set({ historyCursor: history.length - 1, preHistoryDraft: s.composerDraft, composerDraft: history[history.length - 1] })
        return
      }
      const next = Math.max(0, (s.historyCursor ?? 0) - 1)
      set({ historyCursor: next, composerDraft: history[next] })
      return
    }
    // down
    const cursor = s.historyCursor
    if (cursor === null || cursor === undefined) return
    if (cursor >= history.length - 1) {
      set({ historyCursor: null, composerDraft: s.preHistoryDraft ?? '', preHistoryDraft: '' })
      return
    }
    const next = cursor + 1
    set({ historyCursor: next, composerDraft: history[next] })
  },

  connect: () => {
    const offMessage = subscribe('agent:message', ({ message }) => {
      set((s) => applySdkMessage(s, message))
    })
    const offStatus = subscribe('agent:status', (event: AgentStatusEvent) => {
      set((s) => applyAgentStatus(s, event.status, event))
    })
    const offError = subscribe('agent:error', (event: AgentErrorEvent) => {
      set((s) => applyAgentError(s, event.error))
    })
    // 记忆链路（spec: memory-rendering）
    const offMemoryRecalled = subscribe('memory:recalled', (event: MemoryRecalledEvent) => {
      set((s) => applyMemoryRecalled(s, event))
    })
    const offMemoryDistilled = subscribe('memory:distilled', (event: MemoryDistilledEvent) => {
      set({
        lastDistill: {
          added: event.added,
          updated: event.updated,
          retired: event.retired,
          updatedAt: Date.now()
        }
      })
    })
    return () => {
      offMessage()
      offStatus()
      offError()
      offMemoryRecalled()
      offMemoryDistilled()
    }
  }
}))

/** 测试辅助：直接灌入状态 */
export const __setItems = (items: UiItem[]): void => {
  useChatStore.setState({ items })
}
