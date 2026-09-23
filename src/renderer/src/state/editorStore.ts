import { create } from 'zustand'
import { invoke } from '../ipc/client'

interface EditorTab {
  path: string
  content: string
  dirty: boolean
  size: number
  mtime: number
  isBinary: boolean
  isTooLarge: boolean
  /** spec: file-watcher —— 远端修改但本地有未保存改动，需用户决定 */
  conflict?: boolean
}

interface CursorHint {
  path: string
  line: number
  column?: number
}

interface OpenOptions {
  content: string
  size: number
  mtime: number
  isBinary: boolean
  isTooLarge: boolean
  /** spec: search-navigation —— 一次性导航意图（不是 tab 状态） */
  cursor?: { line: number; column?: number }
}

interface EditorState {
  tabs: EditorTab[]
  activePath: string | null
  /** 待消费的导航意图；EditorArea 命中后清空 */
  pendingCursor: CursorHint | null
  open: (path: string, opts: OpenOptions) => void
  close: (path: string) => void
  closeAll: () => void
  restoreFromPaths: (paths: string[]) => Promise<void>
  setActive: (path: string) => void
  updateContent: (path: string, content: string) => void
  markSaved: (path: string) => void
  /** 由 EditorArea 消费后调用 */
  clearPendingCursor: () => void
  /** spec: file-watcher —— 静默重载（保留 dirty 状态） */
  reloadFromDisk: (path: string, content: string, mtime: number, size: number) => void
  /** spec: file-watcher —— 标记远端冲突（脏 tab） */
  markConflict: (path: string) => void
  /** 用户接受远端版本 → 清掉冲突与脏 */
  acceptRemote: (path: string) => void
}

export const useEditorStore = create<EditorState>((set) => ({
  tabs: [],
  activePath: null,
  pendingCursor: null,

  open: (path, opts) =>
    set((s) => {
      const existing = s.tabs.find((t) => t.path === path)
      const next: Partial<EditorState> = {
        activePath: path,
        pendingCursor: opts.cursor ? { path, line: opts.cursor.line, column: opts.cursor.column } : s.pendingCursor
      }
      if (existing) {
        return { ...next, tabs: s.tabs } as EditorState
      }
      return {
        ...next,
        tabs: [
          ...s.tabs,
          {
            path,
            content: opts.content,
            dirty: false,
            size: opts.size,
            mtime: opts.mtime,
            isBinary: opts.isBinary,
            isTooLarge: opts.isTooLarge
          }
        ]
      } as EditorState
    }),

  close: (path) =>
    set((s) => {
      const idx = s.tabs.findIndex((t) => t.path === path)
      if (idx === -1) return s
      const tabs = s.tabs.filter((t) => t.path !== path)
      let activePath = s.activePath
      if (activePath === path) {
        const fallback = tabs[idx] ?? tabs[idx - 1] ?? null
        activePath = fallback?.path ?? null
      }
      const next: EditorState = { ...s, tabs, activePath }
      if (s.pendingCursor?.path === path) next.pendingCursor = null
      return next
    }),

  closeAll: () => set({ tabs: [], activePath: null, pendingCursor: null }),

  restoreFromPaths: async (paths) => {
    const { tabs } = useEditorStore.getState()
    const currentPaths = new Set(tabs.map((t) => t.path))
    for (const path of paths) {
      if (currentPaths.has(path)) continue
      try {
        const content = await invoke('file:read', { path })
        set((s) => ({
          activePath: path,
          tabs: [
            ...s.tabs,
            {
              path,
              content: content.content,
              dirty: false,
              size: content.size,
              mtime: content.mtime,
              isBinary: content.isBinary,
              isTooLarge: content.isTooLarge
            }
          ]
        }))
      } catch {
        // 文件已不存在则跳过
      }
    }
  },

  setActive: (path) => set({ activePath: path }),

  updateContent: (path, content) =>
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.path === path ? { ...t, content, dirty: true } : t
      )
    })),

  markSaved: (path) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.path === path ? { ...t, dirty: false, conflict: false } : t))
    })),

  clearPendingCursor: () => set({ pendingCursor: null }),

  reloadFromDisk: (path, content, mtime, size) =>
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.path === path ? { ...t, content, mtime, size, conflict: false } : t
      )
    })),

  markConflict: (path) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.path === path ? { ...t, conflict: true } : t))
    })),

  acceptRemote: (path) =>
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.path === path ? { ...t, dirty: false, conflict: false } : t
      )
    }))
}))
