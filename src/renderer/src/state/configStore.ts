import type { AppConfig } from '@shared/types'
import { create } from 'zustand'
import { invoke } from '../ipc/client'

export type ThemeName = 'vs' | 'vs-dark' | 'hc-black'

interface EditorPrefs {
  wordWrap: boolean
  minimap: boolean
  fontSize: number
  theme: ThemeName
}

interface ConfigState extends AppConfig {
  loaded: boolean
  editor: EditorPrefs
  /** 最近工作区列表（最新的在前，持久化到 localStorage） */
  recentWorkspaces: string[]
  /**
   * spec: cursor-parity AC-9 —— ThinkingBlock 全局默认展开状态。
   * true：默认展开； false：默认折叠（仅显示摘要）。
   */
  thinkingDefaultExpanded: boolean
  load: () => Promise<void>
  pickWorkspace: () => Promise<void>
  /** 切换到指定 cwd（不弹对话框）；更新 recent 列表与主进程 AgentService */
  switchWorkspace: (path: string) => Promise<void>
  /** 从 recent 列表移除某条记录 */
  removeRecent: (path: string) => void
  setPermissionMode: (mode: AppConfig['permissionMode']) => Promise<void>
  setModel: (model: string) => Promise<void>
  setTheme: (theme: ThemeName) => void
  toggleWordWrap: () => void
  toggleMinimap: () => void
  setFontSize: (size: number) => void
  setThinkingDefaultExpanded: (value: boolean) => void
}

const initialConfig: AppConfig = {
  cwd: '',
  permissionMode: 'default',
  model: 'default',
  agentMode: 'real'
}

const initialEditor: EditorPrefs = {
  wordWrap: false,
  minimap: false,
  fontSize: 13,
  theme: 'vs-dark'
}

const RECENT_KEY = 'recent-workspaces'
const RECENT_MAX = 8
const EDITOR_PREFS_KEY = 'editor-prefs'
const THINKING_KEY = 'thinking-default-expanded'

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return []
    return arr.filter((x): x is string => typeof x === 'string')
  } catch {
    return []
  }
}

function saveRecent(list: string[]): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list))
  } catch {
    // ignore
  }
}

function loadEditorPrefs(): EditorPrefs | null {
  try {
    const raw = localStorage.getItem(EDITOR_PREFS_KEY)
    if (!raw) return null
    const obj = JSON.parse(raw) as Partial<EditorPrefs>
    return {
      wordWrap: Boolean(obj.wordWrap),
      minimap: obj.minimap ?? false,
      fontSize: typeof obj.fontSize === 'number' ? obj.fontSize : 13,
      theme: (obj.theme as ThemeName) ?? 'vs-dark'
    }
  } catch {
    return null
  }
}

function saveEditorPrefs(p: EditorPrefs): void {
  try {
    localStorage.setItem(EDITOR_PREFS_KEY, JSON.stringify(p))
  } catch {
    // ignore
  }
}

function loadThinkingDefault(): boolean {
  try {
    return localStorage.getItem(THINKING_KEY) === 'true'
  } catch {
    return false
  }
}

function saveThinkingDefault(value: boolean): void {
  try {
    localStorage.setItem(THINKING_KEY, String(value))
  } catch {
    // ignore
  }
}

/**
 * 应用配置状态（app-config spec）。
 * 通过 config:get / config:set 与主进程 AgentService 状态同步。
 * 编辑器偏好与最近工作区是渲染层本地状态，持久化到 localStorage。
 */
export const useConfigStore = create<ConfigState>((set, get) => ({
  ...initialConfig,
  loaded: false,
  editor: loadEditorPrefs() ?? { ...initialEditor },
  recentWorkspaces: loadRecent(),
  thinkingDefaultExpanded: loadThinkingDefault(),

  load: async () => {
    const config = await invoke('config:get')
    // spec: light-theme —— 加载时同步应用主题到 documentElement
    const theme = get().editor.theme
    document.documentElement.dataset.theme = theme === 'vs' ? 'light' : 'dark'
    set({ ...config, loaded: true })
  },

  pickWorkspace: async () => {
    const picked = await invoke('workspace:pick')
    if (!picked) return
    await get().switchWorkspace(picked)
  },

  switchWorkspace: async (path) => {
    // 验证目录存在：失败则从 recent 移除
    try {
      await invoke('file:list', { path, depth: 1 })
    } catch {
      get().removeRecent(path)
      throw new Error(`工作目录不存在或不可访问: ${path}`)
    }
    await invoke('config:set', { cwd: path })
    set((s) => {
      const next = [path, ...s.recentWorkspaces.filter((p) => p !== path)].slice(0, RECENT_MAX)
      saveRecent(next)
      return { cwd: path, recentWorkspaces: next }
    })
  },

  removeRecent: (path) =>
    set((s) => {
      const next = s.recentWorkspaces.filter((p) => p !== path)
      saveRecent(next)
      return { recentWorkspaces: next }
    }),

  setPermissionMode: async (mode) => {
    await invoke('agent:setPermissionMode', { mode })
    set({ permissionMode: mode })
  },

  setModel: async (model) => {
    await invoke('config:set', { model })
    set({ model })
  },

  setTheme: (theme) => {
    // spec: light-theme —— 同步 document.documentElement.dataset.theme 并持久化
    document.documentElement.dataset.theme = theme === 'vs' ? 'light' : 'dark'
    set((s) => {
      const editor = { ...s.editor, theme }
      saveEditorPrefs(editor)
      return { editor }
    })
  },

  toggleWordWrap: () =>
    set((s) => {
      const editor = { ...s.editor, wordWrap: !s.editor.wordWrap }
      saveEditorPrefs(editor)
      return { editor }
    }),

  toggleMinimap: () =>
    set((s) => {
      const editor = { ...s.editor, minimap: !s.editor.minimap }
      saveEditorPrefs(editor)
      return { editor }
    }),

  setFontSize: (fontSize) =>
    set((s) => {
      const editor = { ...s.editor, fontSize }
      saveEditorPrefs(editor)
      return { editor }
    }),

  setThinkingDefaultExpanded: (value) => {
    saveThinkingDefault(value)
    set({ thinkingDefaultExpanded: value })
  }
}))