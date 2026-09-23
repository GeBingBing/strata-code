import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AppShell } from './AppShell'
import { useChatStore } from '../state/chatStore'
import { useConfigStore } from '../state/configStore'
import { useSessionStore } from '../state/sessionStore'
import { useWorkspaceStore } from '../state/workspaceStore'
import { useSidebarStore } from '../state/sidebarStore'
import { setIpcOverride } from '../ipc/client'
import { registerPanel } from '../lib/sidebarRegistry'
import { FilesIcon, SessionsIcon } from './icons'
import type { RendererApi } from '@shared/ipc'

/** spec: app-config —— 主工具栏与运行中禁用策略 */

const invokeMock = vi.fn()

function makeApi(): RendererApi {
  return {
    invoke: invokeMock.mockResolvedValue([]) as never,
    on: (() => () => {}) as never
  }
}

const unregisters: Array<() => void> = []

function registerTestPanels(): void {
  unregisters.push(
    registerPanel({
      id: 'files',
      title: 'Files',
      icon: FilesIcon,
      component: () => <div data-testid="files-panel" />,
      order: 0
    }),
    registerPanel({
      id: 'sessions',
      title: 'Sessions',
      icon: SessionsIcon,
      component: () => <div data-testid="session-sidebar" />,
      order: 1
    })
  )
}

beforeEach(() => {
  unregisters.splice(0).forEach((u) => u())
  invokeMock.mockReset().mockResolvedValue([])
  setIpcOverride(makeApi())
  useChatStore.setState({
    status: 'idle',
    items: [],
    streamingId: null
  })
  useConfigStore.setState({
    cwd: '/project',
    permissionMode: 'default',
    model: 'default',
    agentMode: 'real',
    loaded: true,
    recentWorkspaces: [],
    editor: { wordWrap: false, minimap: false, fontSize: 13, theme: 'vs-dark' },
    load: useConfigStore.getState().load,
    pickWorkspace: useConfigStore.getState().pickWorkspace,
    switchWorkspace: useConfigStore.getState().switchWorkspace,
    removeRecent: useConfigStore.getState().removeRecent,
    setPermissionMode: useConfigStore.getState().setPermissionMode,
    setModel: useConfigStore.getState().setModel,
    setTheme: useConfigStore.getState().setTheme,
    toggleWordWrap: useConfigStore.getState().toggleWordWrap,
    toggleMinimap: useConfigStore.getState().toggleMinimap,
    setFontSize: useConfigStore.getState().setFontSize
  })
  useSessionStore.setState({
    sessions: [],
    activeId: null,
    load: async () => {},
    connect: () => () => {},
    open: async () => {},
    rename: async () => {},
    remove: async () => {},
    newChat: () => {}
  })
  useWorkspaceStore.setState({
    workspaces: [{ id: 'w1', path: '/project', name: 'project', lastOpenedAt: 1 }],
    openIds: ['w1'],
    activeId: 'w1',
    loaded: true,
    load: async () => {},
    open: async () => {},
    switch: async () => {},
    close: async () => {},
    updateState: async () => {}
  })
  useSidebarStore.setState({
    tab: 'files',
    collapsed: false,
    setTab: useSidebarStore.getState().setTab,
    toggleCollapsed: useSidebarStore.getState().toggleCollapsed,
    setCollapsed: useSidebarStore.getState().setCollapsed
  })
  registerTestPanels()
})

describe('AppShell', () => {
  it('渲染主工具栏、活动栏与选择器', () => {
    render(<AppShell />)
    expect(screen.getByTestId('main-toolbar')).toBeInTheDocument()
    expect(screen.getByTestId('permission-mode-selector')).toBeInTheDocument()
    expect(screen.getByTestId('model-selector')).toBeInTheDocument()
    expect(screen.getByTestId('activity-bar')).toBeInTheDocument()
    expect(screen.getByTestId('status-bar')).toBeInTheDocument()
  })

  it('点击 sessions 图标显示 SessionSidebar', () => {
    render(<AppShell />)
    fireEvent.click(screen.getByTestId('activity-sessions'))
    expect(screen.getByTestId('session-sidebar')).toBeInTheDocument()
  })

  it('点击活动栏 collapse 按钮隐藏 sidebar', () => {
    render(<AppShell />)
    const shell = screen.getByTestId('activity-bar').parentElement
    expect(shell?.classList.contains('sidebar-collapsed')).toBe(false)
    fireEvent.click(screen.getByTestId('activity-collapse'))
    expect(shell?.classList.contains('sidebar-collapsed')).toBe(true)
  })

  it('运行中禁用权限模式与模型选择器', () => {
    useChatStore.setState({ status: 'running' })
    render(<AppShell />)
    expect((screen.getByTestId('permission-mode-selector') as HTMLSelectElement).disabled).toBe(true)
    expect((screen.getByTestId('model-selector') as HTMLSelectElement).disabled).toBe(true)
  })

  it('点击导出 Markdown/JSON 调用 chatStore.exportSession', async () => {
    render(<AppShell />)

    fireEvent.click(screen.getByTestId('export-md'))
    await vi.waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('session:export', expect.objectContaining({
        content: expect.stringContaining('# 会话导出')
      }))
    })

    invokeMock.mockClear()
    fireEvent.click(screen.getByTestId('export-json'))
    await vi.waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('session:export', expect.objectContaining({
        content: '[]'
      }))
    })
  })
})
