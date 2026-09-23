import { create } from 'zustand'
import type { SessionSummary } from '@shared/types'
import { invoke, subscribe } from '../ipc/client'
import { useChatStore } from './chatStore'
import { useConfigStore } from './configStore'
import { useEditorStore } from './editorStore'

interface SessionState {
  sessions: SessionSummary[]
  /** 当前激活的会话 id（null = 新对话） */
  activeId: string | null
  load: () => Promise<void>
  /** 订阅 agent 状态事件，状态变化时刷新列表（新会话/活动更新 updatedAt） */
  connect: () => () => void
  open: (id: string) => Promise<void>
  rename: (id: string, title: string) => Promise<void>
  remove: (id: string) => Promise<void>
  newChat: () => void
}

/**
 * 会话列表状态（session-history spec AC-4）。
 * 打开历史会话：先恢复 cwd，再回放历史消息 + 后续 send 带 resume 由主进程恢复上下文。
 */
export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  activeId: null,

  load: async () => {
    const sessions = await invoke('sessions:list')
    set({ sessions })
  },

  connect: () => {
    let loading = false
    return subscribe('agent:status', () => {
      if (loading) return
      loading = true
      void invoke('sessions:list')
        .then((sessions) => set({ sessions }))
        .finally(() => {
          loading = false
        })
    })
  },

  open: async (id) => {
    const summary = get().sessions.find((s) => s.id === id)
    const targetCwd = summary?.cwd
    const currentCwd = useConfigStore.getState().cwd

    if (targetCwd && targetCwd !== currentCwd) {
      const hasDirty = useEditorStore.getState().tabs.some((t) => t.dirty)
      if (hasDirty) {
        const ok = window.confirm('切换工作目录会关闭当前未保存的文件，是否继续？')
        if (!ok) return
      }
      await useConfigStore.getState().switchWorkspace(targetCwd)
    }

    set({ activeId: id })
    const messages = await invoke('sessions:read', { id })
    useChatStore.getState().openSession(messages)
  },

  rename: async (id, title) => {
    await invoke('sessions:rename', { id, title })
    await get().load()
  },

  remove: async (id) => {
    await invoke('sessions:delete', { id })
    if (get().activeId === id) {
      set({ activeId: null })
      useChatStore.getState().reset()
    }
    await get().load()
  },

  newChat: () => {
    set({ activeId: null })
    useChatStore.getState().reset()
  }
}))
