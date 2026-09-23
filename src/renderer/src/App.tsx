import { useEffect, useState } from 'react'
import { useChatStore } from './state/chatStore'
import { useConfigStore } from './state/configStore'
import { usePermissionStore } from './state/permissionStore'
import { useSessionStore } from './state/sessionStore'
import { useWorkspaceStore } from './state/workspaceStore'
import { useEditorStore } from './state/editorStore'
import { invoke } from './ipc/client'
import { AppShell } from './components/AppShell'
import { WelcomePage } from './components/WelcomePage'
import { CommandPalette } from './components/CommandPalette'
import { QuickOpen } from './components/QuickOpen'
import { SettingsModal } from './components/settings/SettingsModal'
import { registerAllCommands } from './lib/registerCommands'
import { registerPanel } from './lib/sidebarRegistry'
import { subscribe } from './ipc/client'
import { FilesIcon, SessionsIcon, SearchIcon, BrainIcon, GitIcon } from './components/icons'
import { RecentWorkspaces } from './components/RecentWorkspaces'
import { FileTree } from './components/editor/FileTree'
import { SessionSidebar } from './components/sessions/SessionSidebar'
import { SearchPanel } from './components/sidebar/SearchPanel'
import { GitPanel } from './components/sidebar/GitPanel'
import { MemoryPanel } from './components/sidebar/MemoryPanel'

function FilesPanel(): React.JSX.Element {
  return (
    <>
      <RecentWorkspaces />
      <FileTree />
    </>
  )
}

// 内置面板注册（App 挂载时执行一次）
const builtinUnregisters: Array<() => void> = []
function registerBuiltinPanels(): void {
  builtinUnregisters.push(
    registerPanel({
      id: 'files',
      title: '文件',
      icon: FilesIcon,
      component: FilesPanel,
      order: 0
    }),
    registerPanel({
      id: 'sessions',
      title: '会话',
      icon: SessionsIcon,
      component: SessionSidebar,
      order: 1
    }),
    registerPanel({
      id: 'search',
      title: '搜索',
      icon: SearchIcon,
      component: SearchPanel,
      order: 2
    }),
    registerPanel({
      id: 'memory',
      title: '记忆',
      icon: BrainIcon,
      component: MemoryPanel,
      order: 3
    }),
    registerPanel({
      id: 'git',
      title: 'Git',
      icon: GitIcon,
      component: GitPanel,
      order: 4
    })
  )
}

export function App(): React.JSX.Element {
  const connectChat = useChatStore((s) => s.connect)
  const connectPermission = usePermissionStore((s) => s.connect)
  const connectSessions = useSessionStore((s) => s.connect)
  const loadConfig = useConfigStore((s) => s.load)
  const loadSessions = useSessionStore((s) => s.load)
  const loadWorkspaces = useWorkspaceStore((s) => s.load)
  const newChat = useSessionStore((s) => s.newChat)
  const pickWorkspace = useConfigStore((s) => s.pickWorkspace)
  const configLoaded = useConfigStore((s) => s.loaded)
  const workspacesLoaded = useWorkspaceStore((s) => s.loaded)
  const openWorkspaceIds = useWorkspaceStore((s) => s.openIds)
  const switchWorkspace = useWorkspaceStore((s) => s.switch)

  const [paletteOpen, setPaletteOpen] = useState(false)
  const [quickOpenOpen, setQuickOpenOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const allLoaded = configLoaded && workspacesLoaded
  const hasWorkspace = openWorkspaceIds.length > 0
  const showWelcome = allLoaded && !hasWorkspace

  useEffect(() => {
    registerBuiltinPanels()

    const offs = [connectChat(), connectPermission(), connectSessions()]

    async function init(): Promise<void> {
      await loadConfig()
      await loadSessions()
      await loadWorkspaces()
      // 如果有持久化的活跃工作区，恢复它
      const state = useWorkspaceStore.getState()
      if (state.activeId) {
        await switchWorkspace(state.activeId)
      } else if (state.openIds.length === 0) {
        // 无持久化工作区时，把当前 cwd 作为默认工作区打开（兼容 E2E / 首次启动）
        const cwd = useConfigStore.getState().cwd
        if (cwd) {
          await useWorkspaceStore.getState().open(cwd)
        }
      }
    }
    void init()

    // 注册命令面板
    const unregisterCommands = registerAllCommands()

    // 原生菜单事件（native-menu spec）
    const offMenuNewChat = subscribe('menu:new-chat', () => newChat())
    const offMenuOpenWorkspace = subscribe('menu:open-workspace', () => void pickWorkspace())
    const offMenuOpenSettings = subscribe('menu:open-settings', () => {
      setSettingsOpen(true)
    })
    const offMenuReload = subscribe('menu:reload', () => {
      window.location.reload()
    })

    // 命令面板打开设置
    const onOpenSettings = (): void => setSettingsOpen(true)
    window.addEventListener('app:open-settings', onOpenSettings)

    // spec: file-watcher —— 监听远端文件变更
    const offFileChanged = subscribe('file:changed', (event: { path: string; kind: 'change' | 'rename' }) => {
      void (async (): Promise<void> => {
        const tabs = useEditorStore.getState().tabs
        const tab = tabs.find((t) => t.path === event.path)
        if (!tab) {
          window.dispatchEvent(new CustomEvent('file-tree-refresh', { detail: { path: event.path } }))
          return
        }
        if (tab.dirty) {
          useEditorStore.getState().markConflict(event.path)
          return
        }
        try {
          const fc = await invoke('file:read', { path: event.path })
          useEditorStore.getState().reloadFromDisk(event.path, fc.content, fc.mtime, fc.size)
        } catch {
          // 文件可能已删除：忽略
        }
      })()
    })

    // 键盘快捷键
    const onKey = (e: KeyboardEvent): void => {
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        setPaletteOpen(true)
      } else if (meta && e.key.toLowerCase() === 'p' && !e.shiftKey) {
        e.preventDefault()
        setQuickOpenOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)

    return () => {
      builtinUnregisters.forEach((u) => u())
      offs.forEach((off) => off())
      offMenuNewChat()
      offMenuOpenWorkspace()
      offMenuOpenSettings()
      offMenuReload()
      unregisterCommands()
      window.removeEventListener('app:open-settings', onOpenSettings)
      window.removeEventListener('keydown', onKey)
      offFileChanged()
    }
  }, [connectChat, connectPermission, connectSessions, loadConfig, loadSessions, loadWorkspaces, newChat, pickWorkspace, switchWorkspace])

  return (
    <>
      {allLoaded ? (showWelcome ? <WelcomePage /> : <AppShell />) : null}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <QuickOpen open={quickOpenOpen} onClose={() => setQuickOpenOpen(false)} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  )
}
