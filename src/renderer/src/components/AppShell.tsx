import { useChatStore } from '../state/chatStore'
import { useEditorStore } from '../state/editorStore'
import { useSidebarStore } from '../state/sidebarStore'
import { usePanels } from '../lib/sidebarRegistry'
import { ActivityBar } from './ActivityBar'
import { MainContent } from './MainContent'
import { PermissionModeSelector } from './chat/PermissionModeSelector'
import { ModelSelector } from './chat/ModelSelector'
import { WorkspaceTabs } from './workspace/WorkspaceTabs'
import { StatusBar } from './chat/StatusBar'

export function AppShell(): React.JSX.Element {
  const running = useChatStore((s) => s.status) === 'running'
  const exportSession = useChatStore((s) => s.exportSession)
  const items = useChatStore((s) => s.items)
  const tabs = useEditorStore((s) => s.tabs)
  const dirtyCount = tabs.filter((t) => t.dirty).length
  const sidebarTab = useSidebarStore((s) => s.tab)
  const setTab = useSidebarStore((s) => s.setTab)
  const sidebarCollapsed = useSidebarStore((s) => s.collapsed)
  const toggleCollapsed = useSidebarStore((s) => s.toggleCollapsed)
  const panels = usePanels()

  const activePanel = panels.find((p) => p.id === sidebarTab) ?? panels[0]
  const ActiveComponent = activePanel?.component

  return (
    <div className={`app-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      <ActivityBar
        panels={panels}
        active={sidebarTab}
        onChange={setTab}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleCollapsed}
        hasDirty={dirtyCount > 0}
        itemCount={items.length}
      />
      {!sidebarCollapsed && ActiveComponent && (
        <aside className="sidebar" data-testid="sidebar">
          <ActiveComponent />
        </aside>
      )}
      <main className="main">
        <WorkspaceTabs />
        <header className="main-toolbar" data-testid="main-toolbar">
          <PermissionModeSelector disabled={running} />
          <ModelSelector disabled={running} />
          <div className="toolbar-spacer" />
          <button
            type="button"
            className="btn export-md"
            data-testid="export-md"
            onClick={() => void exportSession('markdown')}
            title="导出为 Markdown"
          >
            导出 MD
          </button>
          <button
            type="button"
            className="btn export-json"
            data-testid="export-json"
            onClick={() => void exportSession('json')}
            title="导出为 JSON"
          >
            导出 JSON
          </button>
        </header>
        <MainContent />
      </main>
      <StatusBar />
    </div>
  )
}
