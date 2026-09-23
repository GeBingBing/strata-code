import { create } from 'zustand'
import type { Workspace, WorkspaceViewState } from '@shared/types'
import { invoke } from '../ipc/client'
import { useConfigStore } from './configStore'
import { useSessionStore } from './sessionStore'
import { useEditorStore } from './editorStore'
import { useSidebarStore } from './sidebarStore'
import { useChatStore } from './chatStore'

interface WorkspaceState {
  workspaces: Workspace[]
  openIds: string[]
  activeId: string | null
  loaded: boolean
  load: () => Promise<void>
  open: (path: string) => Promise<void>
  switch: (id: string) => Promise<void>
  close: (id: string) => Promise<void>
  updateState: (state: Partial<WorkspaceViewState>) => Promise<void>
}

function getActiveWorkspace(state: WorkspaceState): Workspace | undefined {
  return state.workspaces.find((w) => w.id === state.activeId)
}

function collectViewState(): WorkspaceViewState {
  return {
    activeSessionId: useSessionStore.getState().activeId ?? undefined,
    openFilePaths: useEditorStore.getState().tabs.map((t) => t.path),
    sidebarTab: useSidebarStore.getState().tab,
    // spec: composer-history AC-5 —— 草稿持久化到 workspace view state
    chatInputDraft: useChatStore.getState().composerDraft || undefined
  }
}

async function restoreViewState(state: WorkspaceViewState): Promise<void> {
  if (state.sidebarTab) {
    useSidebarStore.setState({ tab: state.sidebarTab as 'files' | 'sessions' })
  }

  if (state.openFilePaths && state.openFilePaths.length > 0) {
    useEditorStore.getState().restoreFromPaths(state.openFilePaths)
  } else {
    useEditorStore.getState().closeAll()
  }

  // spec: composer-history AC-6 —— 恢复目标工作区上次的 Composer 草稿
  useChatStore.setState({ composerDraft: state.chatInputDraft ?? '' })

  if (state.activeSessionId) {
    await useSessionStore.getState().open(state.activeSessionId)
  } else {
    useSessionStore.getState().newChat()
  }
}

/**
 * 工作区状态（spec: workspace-management）。
 * 管理多个打开的工作区、活跃切换、视图状态保存/恢复。
 */
export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  openIds: [],
  activeId: null,
  loaded: false,

  load: async () => {
    const result = await invoke('workspace:list')
    set({
      workspaces: result.workspaces,
      openIds: result.openIds,
      activeId: result.activeId,
      loaded: true
    })
  },

  open: async (path) => {
    const ws = await invoke('workspace:open', { path })
    set((s) => ({
      workspaces: s.workspaces.some((w) => w.id === ws.id)
        ? s.workspaces.map((w) => (w.id === ws.id ? ws : w))
        : [ws, ...s.workspaces],
      openIds: s.openIds.includes(ws.id) ? s.openIds : [...s.openIds, ws.id],
      activeId: ws.id
    }))
    await useConfigStore.getState().switchWorkspace(path)
    await restoreViewState({})
  },

  switch: async (id) => {
    const current = getActiveWorkspace(get())
    if (current) {
      await invoke('workspace:updateState', { id: current.id, state: collectViewState() })
    }

    const state = await invoke('workspace:switch', { id })
    const result = await invoke('workspace:list')
    const ws = result.workspaces.find((w) => w.id === id)
    if (!ws) return

    set({
      workspaces: result.workspaces,
      openIds: result.openIds,
      activeId: result.activeId
    })

    await useConfigStore.getState().switchWorkspace(ws.path)
    await restoreViewState(state)
  },

  close: async (id) => {
    const isLast = get().openIds.length === 1 && get().openIds[0] === id
    if (isLast) {
      const hasDirty = useEditorStore.getState().tabs.some((t) => t.dirty)
      if (hasDirty) {
        const ok = window.confirm('关闭最后一个工作区将丢失未保存的更改，是否继续？')
        if (!ok) return
      }
    }

    const { activeId } = await invoke('workspace:close', { id })
    const result = await invoke('workspace:list')
    set({
      workspaces: result.workspaces,
      openIds: result.openIds,
      activeId
    })

    if (activeId) {
      const ws = result.workspaces.find((w) => w.id === activeId)
      if (ws) {
        const state = await invoke('workspace:switch', { id: activeId })
        await useConfigStore.getState().switchWorkspace(ws.path)
        await restoreViewState(state)
      }
    } else {
      useConfigStore.setState({ cwd: '' })
      useEditorStore.getState().closeAll()
      useSessionStore.getState().newChat()
    }
  },

  updateState: async (state) => {
    const current = getActiveWorkspace(get())
    if (!current) return
    await invoke('workspace:updateState', { id: current.id, state })
  }
}))
